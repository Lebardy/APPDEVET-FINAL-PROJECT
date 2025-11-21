## Supabase backend setup

1. **Tables**
   ```sql
   create table if not exists public.profiles (
     id uuid primary key references auth.users(id) on delete cascade,
     email text,
     created_at timestamptz default now()
   );

   create table if not exists public.posts (
     id bigint generated always as identity primary key,
     user_id uuid references auth.users(id) on delete cascade,
     content text,
     file_url text,
     created_at timestamptz not null default now()
   );
   ```

2. **Trigger to sync profiles**
   ```sql
   create or replace function public.handle_new_user()
   returns trigger as $$
   begin
     insert into public.profiles (id, email)
     values (new.id, new.email)
     on conflict (id) do update set email = excluded.email;
     return new;
   end;
   $$ language plpgsql security definer;

   drop trigger if exists on_auth_user_created on auth.users;
   create trigger on_auth_user_created
     after insert on auth.users
     for each row execute procedure public.handle_new_user();
   ```

3. **Row-Level Security**
   ```sql
   alter table public.profiles enable row level security;
   alter table public.posts enable row level security;

   create policy "Profiles readable by all"
     on public.profiles for select using (true);

   create policy "Posts readable by all"
     on public.posts for select using (true);

   create policy "Users insert own posts"
     on public.posts for insert with check (auth.uid() = user_id);

   create policy "Users update own posts"
     on public.posts for update using (auth.uid() = user_id);

   create policy "Users delete own posts"
     on public.posts for delete using (auth.uid() = user_id);
   ```

4. **Storage bucket**
   - Create bucket named `media` (public).
   - Policies:
     ```sql
     create policy "Public read media"
       on storage.objects for select
       using (bucket_id = 'media');

     create policy "Users upload media"
       on storage.objects for insert
       with check (bucket_id = 'media' and auth.uid()::text = split_part(name, '_', 1));

     create policy "Users delete media"
       on storage.objects for delete
       using (bucket_id = 'media' and auth.uid()::text = split_part(name, '_', 1));
     ```

5. **Environment variables**
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
   EXPO_PUBLIC_SUPABASE_KEY=your-anon-public-key
   ```

Run through these steps once, then `npx expo start` to use the mobile client.

