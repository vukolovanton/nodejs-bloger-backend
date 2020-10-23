import { ObjectType, Field, Int } from "type-graphql";
import {
	BaseEntity,
	Column,
	CreateDateColumn,
	Entity,
	ManyToOne,
	OneToMany,
	PrimaryGeneratedColumn,
	UpdateDateColumn,
} from "typeorm";
import { Upvote } from "./Upvote";
import { User } from "./User";

@ObjectType()
@Entity()
export class Post extends BaseEntity {
	@Field(() => Int)
	@PrimaryGeneratedColumn()
	id!: number;

	@Field(() => String)
	@CreateDateColumn()
	createdAt: Date;

	@Field(() => String)
	@UpdateDateColumn()
	updatedAt: Date;

	@Field()
	@Column()
	title!: string;

	@Field()
	@Column()
	text!: string;

	@Field()
	@Column({ type: "int", default: 0 })
	points!: number;

	@Field()
	@Column()
	creatorId: number;

	@Field()
	@ManyToOne(() => User, (user) => user.posts)
	creator: User;

	@OneToMany(() => Upvote, (upvote) => upvote.post)
	upvotes: Upvote[];
}
