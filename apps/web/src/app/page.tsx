import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { MapPin } from "lucide-react";

interface Restaurant {
  id: string;
  name: string;
  city: string;
  slug: string;
  is_active: boolean;
}

export default async function RestaurantsPage() {
  const supabase = await createClient();
  const { data: restaurants } = await supabase
    .from("restaurants")
    .select("*")
    .eq("is_active", true)
    .order("name");

  return (
    <div className="mx-auto max-w-4xl px-4 py-8">
      <h1 className="mb-6 text-2xl font-bold text-white">Заведения</h1>

      {!restaurants || restaurants.length === 0 ? (
        <div className="py-16 text-center text-gray-400">
          <p className="text-lg">Нет доступных заведений</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2">
          {restaurants.map((r: Restaurant) => (
            <Link
              key={r.id}
              href={`/r/${r.slug}/plans`}
              className="rounded-lg border border-gray-800 bg-card p-5 transition-all hover:border-brand/30 hover:bg-card-hover group"
            >
              <h2 className="text-lg font-semibold text-white transition-colors group-hover:text-brand">
                {r.name}
              </h2>
              <p className="mt-1 flex items-center gap-1 text-sm text-gray-400">
                <MapPin className="h-3.5 w-3.5" />
                {r.city}
              </p>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
