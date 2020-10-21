import { UserInput } from "src/resolvers/UserInput";

export const validateRegister = (options: UserInput) => {
	if (!options.email.includes("@")) {
		return [
			{
				field: "username",
				message: "invalid email",
			},
		];
	}

	if (options.username.includes("@")) {
		return [
			{
				field: "username",
				message: "invalid username ",
			},
		];
	}

	if (options.username.length <= 2) {
		return [
			{
				field: "username",
				message: "length must be greater than 2",
			},
		];
	}

	return null;
};
