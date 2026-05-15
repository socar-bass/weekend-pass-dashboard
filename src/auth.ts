import NextAuth from "next-auth";
import Google from "next-auth/providers/google";

function getAllowedEmails(): string[] {
  const emails = process.env.ALLOWED_EMAILS ?? "";
  return emails
    .split(",")
    .map((email) => email.trim())
    .filter(Boolean);
}

function isEmailAllowed(
  email: string | null | undefined,
  patterns: string[]
): boolean {
  if (!email) return false;
  const normalized = email.toLowerCase();
  return patterns.some((p) => {
    const pattern = p.toLowerCase();
    if (pattern.startsWith("@")) {
      return normalized.endsWith(pattern);
    }
    return pattern === normalized;
  });
}

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [
    Google({
      authorization: {
        params: { hd: "socar.kr", scope: "openid email profile" },
      },
    }),
  ],
  pages: {
    signIn: "/login",
    error: "/login",
  },
  session: { strategy: "jwt" },
  callbacks: {
    signIn({ user }) {
      const allowed = getAllowedEmails();
      if (allowed.length === 0) {
        return process.env.NODE_ENV !== "production";
      }
      return isEmailAllowed(user.email, allowed);
    },
  },
});
