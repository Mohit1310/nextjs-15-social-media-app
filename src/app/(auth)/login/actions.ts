"use server";

import prisma from "@/lib/prisma";
import { LoginValues, loginSchema } from "@/lib/validations";
import { isRedirectError } from "next/dist/client/components/redirect";
import { verify } from "@node-rs/argon2";
import { lucia } from "@/auth";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

/**
 * Logs in a user with the provided credentials.
 * @param {LoginValues} credentials - The login credentials containing username and password.
 * @returns {Promise<{ error: string }>} An object with an error message if login fails.
 * @throws {Error} If an unexpected error occurs during the login process.
 */
export async function login(
  credentials: LoginValues,
): Promise<{ error: string }> {
  try {
    const { username, password } = loginSchema.parse(credentials);

    const exisitinUser = await prisma.user.findFirst({
      where: {
        username: {
          equals: username,
          mode: "insensitive",
        },
      },
    });

    if (!exisitinUser || !exisitinUser.passwordHash) {
      return {
        error: "Incorrect username or password",
      };
    }

    const validPassword = await verify(exisitinUser.passwordHash, password, {
      memoryCost: 19456,
      timeCost: 2,
      outputLen: 32,
      parallelism: 1,
    });

    if (!validPassword) {
      return {
        error: "Incorrect username or password",
      };
    }

    const session = await lucia.createSession(exisitinUser.id, {});
    const sessionCookie = lucia.createSessionCookie(session.id);
    cookies().set(
      sessionCookie.name,
      sessionCookie.value,
      sessionCookie.attributes,
    );

    return redirect("/");
  } catch (error) {
    if (isRedirectError(error)) throw error;
    console.error(error);
    return {
      error: "Something went wrong. Please try again",
    };
  }
}
