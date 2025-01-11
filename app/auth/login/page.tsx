import { LoginButton } from "@/app/components/auth/login-button";

export default function LoginPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center py-2">
      <div className="flex w-full max-w-sm flex-col space-y-4 p-4">
        <h1 className="text-2xl font-bold text-center">Welcome Back</h1>
        <LoginButton />
      </div>
    </div>
  );
}
