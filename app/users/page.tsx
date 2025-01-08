import { createClient } from "@/utils/supabase/server";
import { PostgrestError } from "@supabase/supabase-js";

interface User {
  id: string;
  email: string;
  name: string;
  created_at: string;
}

export default async function UsersPage() {
  const supabase = await createClient();
  const { data: users, error } = (await supabase.from("Users").select("*")) as {
    data: User[] | null;
    error: PostgrestError | null;
  };

  if (error) {
    return <div>Error loading users: {error.message}</div>;
  }

  return (
    <div className="p-4">
      <h1 className="text-2xl font-bold mb-4">Users</h1>
      <pre className="bg-gray-100 p-4 rounded-lg overflow-auto">
        {JSON.stringify(users, null, 2)}
      </pre>
    </div>
  );
}
