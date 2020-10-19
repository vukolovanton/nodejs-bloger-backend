import argon2 from "argon2";
import { EntityManager } from "@mikro-orm/postgresql";
import { User } from "../entities/User";
import { MyContext } from "src/types";
import {
	Resolver,
	Mutation,
	InputType,
	Field,
	Arg,
	Ctx,
	ObjectType,
	Query,
} from "type-graphql";

@InputType()
class UserInput {
	@Field()
	username: string;
	@Field()
	password: string;
}

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
	// Helper query
	@Query(() => User, { nullable: true })
	async me(@Ctx() { req, em }: MyContext) {
		if (!req.session!.userId) {
			return null;
		}
		const user = await em.findOne(User, { id: req.session!.userId });
		return user;
	}

	// Register
	@Mutation(() => UserResponse)
	async register(
		@Arg("options") options: UserInput,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		// much security
		if (options.username.length <= 2) {
			return {
				errors: [
					{
						field: "username",
						message: "length must be greater than 2",
					},
				],
			};
		}

		const hashedPassword = await argon2.hash(options.password);
		let user;
		try {
			const result = await (em as EntityManager)
				.createQueryBuilder(User)
				.getKnexQuery()
				.insert({
					username: options.username,
					password: hashedPassword,
					created_at: new Date(),
					updated_at: new Date(),
				})
				.returning("*");

			user = result[0];
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
		@Arg("options") options: UserInput,
		@Ctx() { em, req }: MyContext
	): Promise<UserResponse> {
		const user = await em.findOne(User, { username: options.username });

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

		const valid = await argon2.verify(user.password, options.password);

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
}
