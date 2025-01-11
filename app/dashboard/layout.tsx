import { redirect } from "next/navigation";
import { cookies } from "next/headers";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const token = cookies().get("next-auth.session-token");

  if (!token) redirect("/auth/login");

  return (
    <div>
      <main>{children}</main>
    </div>
  );
}
