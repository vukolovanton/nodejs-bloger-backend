import argon2 from "argon2";
import { v4 } from "uuid";
import { User } from "../entities/User";
import { MyContext } from "../types";
import {
	Resolver,
	Mutation,
	Field,
	Arg,
	Ctx,
	ObjectType,
	Query,
} from "type-graphql";
import { COOKIE_NAME, FORGET_PASSWORD_PREFIX } from "../constants";
import { UserInput } from "./UserInput";
import { validateRegister } from "../utils/validateRegister";
import { sendEmail } from "../utils/sendEmail";
// import { getConnection } from "typeorm";

@ObjectType()
class FieldError {
	@Field()
	field: string;

	@Field()
	message: string;
}

@ObjectType()
class UserResponse {
	@Field(() => [FieldError], { nullable: true })
	errors?: FieldError[];

	@Field(() => User, { nullable: true })
	user?: User;
}

@Resolver()
export class UserResolver {
	// Helper Me query
	@Query(() => User, { nullable: true })
	async me(@Ctx() { req }: MyContext) {
		if (!req.session!.userId) {
			return null;
		}
		const user = await User.findOne(req.session!.userId);
		return user;
	}

	// Register
	@Mutation(() => UserResponse)
	async register(
		@Arg("options") options: UserInput,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const errors = validateRegister(options);
		if (errors) {
			return { errors };
		}

		const hashedPassword = await argon2.hash(options.password);
		let user;
		try {
			user = await User.create({
				email: options.email,
				username: options.username,
				password: hashedPassword,
			}).save();

			// const result = await getConnection()
			// 	.createQueryBuilder()
			// 	.insert()
			// 	.into(User)
			// 	.values({
			// 		email: options.email,
			// 		username: options.username,
			// 		password: hashedPassword,
			// 	})
			// 	.returning("*")
			// 	.execute();

			// user = result.raw[0];
		} catch (e) {
			return {
				errors: [
					{
						field: "username",
						message: e,
					},
				],
			};
		}
		// Store user id session
		// Set cookie on the user and keep them logged in
		req.session!.userId = user.id;

		return { user };
	}

	// Login
	@Mutation(() => UserResponse)
	async login(
		@Arg("usernameOrEmail") usernameOrEmail: string,
		@Arg("password") password: string,
		@Ctx() { req }: MyContext
	): Promise<UserResponse> {
		const user = await User.findOne(
			usernameOrEmail.includes("@")
				? { where: { email: usernameOrEmail } }
				: { where: { username: usernameOrEmail } }
		);

		if (!user) {
			return {
				errors: [
					{
						field: "username",
						message: "user doesnt exist",
					},
				],
			};
		}

		const valid = await argon2.verify(user.password, password);

		if (!valid) {
			return {
				errors: [
					{
						field: "password",
						message: "incorrect password",
					},
				],
			};
		}

		req.session!.userId = user.id;

		return {
			user,
		};
	}

	// Logout user
	@Mutation(() => Boolean)
	logout(@Ctx() { req, res }: MyContext) {
		return new Promise((resolve) =>
			req.session?.destroy((err) => {
				res.clearCookie(COOKIE_NAME);
				if (err) {
					console.log(err);
					resolve(false);
					return;
				}
				resolve(true);
			})
		);
	}

	// Forgot password
	@Mutation(() => Boolean)
	async forgotPassword(
		@Arg("email") email: string,
		@Ctx() { redis }: MyContext
	) {
		const user = await User.findOne({ where: { email } });
		if (!user) {
			return true;
		}
		const token = v4();
		await redis.set(
			FORGET_PASSWORD_PREFIX + token,
			user.id,
			"ex",
			1000 * 60 * 60 * 24 * 3
		);
		const template = `<a href="http://localhost:3000/change-password/${token}">reset password</a>`;
		await sendEmail(email, template);
		return true;
	}

	// Change password
	@Mutation(() => UserResponse)
	async changePassword(
		@Arg("token") token: string,
		@Arg("newPassword") newPassword: string,
		@Ctx() { req, redis }: MyContext
	): Promise<UserResponse> {
		const userId = await redis.get(FORGET_PASSWORD_PREFIX + token);
		if (!userId) {
			return {
				errors: [
					{
						field: "token",
						message: "token expired",
					},
				],
			};
		}

		const userIdParserd = parseInt(userId);
		const user = await User.findOne(userIdParserd);

		if (!user) {
			return {
				errors: [
					{
						field: "token",
						message: "user no longer exists",
					},
				],
			};
		}

		await User.update(
			{ id: userIdParserd },
			{
				password: await argon2.hash(newPassword),
			}
		);

		// Login user after change password
		req.session!.userId = user.id;

		return { user };
	}
}
