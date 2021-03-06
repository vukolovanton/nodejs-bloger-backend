import { Post } from "../entities/Post";
import {
	Resolver,
	Query,
	Arg,
	Mutation,
	InputType,
	Field,
	Ctx,
	UseMiddleware,
	Int,
	FieldResolver,
	Root,
	ObjectType,
} from "type-graphql";
import { MyContext } from "../types";
import { isAuth } from "../utils/isAuth";
import { getConnection } from "typeorm";
import { Upvote } from "../entities/Upvote";

@InputType()
class PostInput {
	@Field()
	title: string;
	@Field()
	text: string;
}

@ObjectType()
class PaginatedPosts {
	@Field(() => [Post])
	posts: Post[];

	@Field()
	hasMore: boolean;
}

@Resolver(Post)
export class PostResolver {
	@FieldResolver(() => String)
	textSnippet(@Root() root: Post) {
		return root.text.slice(0, 50);
	}

	@Mutation(() => Boolean)
	@UseMiddleware(isAuth)
	async vote(
		@Arg("postId", () => Int) postId: number,
		@Arg("value", () => Int) value: number,
		@Ctx() { req }: MyContext
	) {
		const isUpvote = value !== -1;
		const realValue = isUpvote ? 1 : -1;
		const { userId } = req.session!;
		const upvote = await Upvote.findOne({
			where: { postId, userId },
		});

		if (upvote && upvote.value !== realValue) {
			await getConnection().transaction(async (tm) => {
				await tm.query(
					`
					update upvote
					set value = $1
					where "postId" = $2 and "userId" = $3
        `,
					[realValue, postId, userId]
				);

				await tm.query(
					`
          update post
          set points = points + $1
          where id = $2
        `,
					[2 * realValue, postId]
				);
			});
		} else if (!upvote) {
			// has never voted before
			await getConnection().transaction(async (tm) => {
				await tm.query(
					`
				insert into upvote ("userId", "postId", value)
				values ($1, $2, $3)
        `,
					[userId, postId, realValue]
				);

				await tm.query(
					`
				update post
				set points = points + $1
				where id = $2
      `,
					[realValue, postId]
				);
			});
		}
		return true;
	}
	// Upvote.insert({
	// 	userId,
	// 	postId,
	// 	value: realValue,
	// });

	// Fetch all posts
	@Query(() => PaginatedPosts)
	async posts(
		@Arg("limit", () => Int) limit: number,
		@Arg("cursor", () => String, { nullable: true }) cursor: string | null,
		@Ctx() { req }: MyContext
	): Promise<PaginatedPosts> {
		const realLimit = Math.min(50, limit);
		const realLimitPlusOne = realLimit + 1;

		const replacements: any = [realLimitPlusOne];

		if (req.session!.userId) {
			replacements.push(req.session!.userId);
		}

		if (cursor) {
			replacements.push(new Date(parseInt(cursor)));
		}

		const posts = await getConnection().query(
			`
			SELECT p.*,
			json_build_object(
				'id', u.id,
				'username', u.username,
				'email', u.email,
				'createdAt', u."createdAt",
				'updatedAt', u."updatedAt"
			) creator,
			${
				req.session!.userId
					? '(SELECT value FROM upvote WHERE "userId" = $2 and "postId" = p.id) "voteStatus"'
					: 'null as "voteStatus"'
			}
			FROM post p
			INNER JOIN public.user u on u.id = p."creatorId"
			${cursor ? 'where p."createdAt" < $3' : ""}
			ORDER BY p."createdAt" DESC
			limit $1
		`,
			replacements
		);

		return {
			posts: posts.slice(0, realLimit),
			hasMore: posts.length === realLimitPlusOne,
		};
	}

	// Fetch single post
	@Query(() => Post, { nullable: true })
	post(@Arg("id") id: number): Promise<Post | undefined> {
		return Post.findOne(id);
	}

	// Create single post
	@Mutation(() => Post)
	@UseMiddleware(isAuth)
	async createPost(
		@Arg("input") input: PostInput,
		@Ctx() { req }: MyContext
	): Promise<Post> {
		return Post.create({
			...input,
			creatorId: req.session!.userId,
		}).save();
	}

	// Update post
	@Mutation(() => Post, { nullable: true })
	async updatePost(
		@Arg("id") id: number,
		@Arg("title", () => String, { nullable: true }) title: string
	): Promise<Post | null> {
		const post = await Post.findOne(id);
		if (!post) {
			return null;
		}
		if (typeof title !== "undefined") {
			await Post.update({ id }, { title });
		}
		return post;
	}

	// Delete post
	@Mutation(() => Boolean)
	async deletePost(@Arg("id") id: number): Promise<boolean> {
		await Post.delete(id);
		return true;
	}
}
