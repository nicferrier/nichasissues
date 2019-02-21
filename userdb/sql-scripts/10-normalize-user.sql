CREATE OR REPLACE FUNCTION user_normalize_hook(log_rec log) RETURNS void AS $user_normalize_hook$
begin
  RAISE NOTICE 'user_normalize_hook (%,%,%)', log_rec.id, log_rec.d, log_rec.data->>'summary';
  if log_rec.data->>'action' = 'create' then
     INSERT INTO "user" (username,
                         last_update,
                         created,
                         password,
                         email)
     VALUES (log_rec.data->>'username',
             log_rec.d,
             log_rec.d,
             log_rec.data->>'password',
             log_rec.data->>'email');
  elsif log_rec.data->>'action' = 'session' then
     INSERT INTO user_session (sessionid, created, email)
     VALUES (log_rec.data->>'sessionid',
             log_rec.d,
             log_rec.data->>'email');
  else
     RAISE NOTICE 'user_normalize_hook has action other than create: %', log_rec.data->>'action';
  end if;
end;
$user_normalize_hook$ LANGUAGE plpgsql;
