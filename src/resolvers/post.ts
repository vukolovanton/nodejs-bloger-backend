import { Post } from "../entities/Post";
import {
	Resolver,
	Query,
	Arg,
	Mutation,
	InputType,
	Field,
	Ctx,
} from "type-graphql";
import { MyContext } from "src/types";

@InputType()
class PostInput {
	@Field()
	title: string;
	@Field()
	text: string;
}

@Resolver()
export class PostResolver {
	// Fetch all posts
	@Query(() => [Post])
	async posts(): Promise<Post[]> {
		return Post.find();
	}

	// Fetch single post
	@Query(() => Post, { nullable: true })
	post(@Arg("id") id: number): Promise<Post | undefined> {
		return Post.findOne(id);
	}

	// Create single post
	@Mutation(() => Post)
	async createPost(
		@Arg("input") input: PostInput,
		@Ctx() { req }: MyContext
	): Promise<Post> {
		if (!req.session!.userId) {
			throw new Error("not authenticated");
		}

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
