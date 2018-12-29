CREATE OR REPLACE FUNCTION normalize_hook(log_rec log) RETURNS void AS $normalize_hook$
begin
  RAISE NOTICE 'normalize_hook (%,%,%)', log_rec.id, log_rec.d, log_rec.data->>'summary';
  insert into issue (id, issueid, summary, data)
  values (log_rec.id,
          log_rec.data->>'issueid',
          log_rec.data->>'summary',
          log_rec.data);
end;
$normalize_hook$ LANGUAGE plpgsql;
