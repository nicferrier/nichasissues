create sequence if not exists issue_id;

create table if not exists issue (
id integer,
last_update timestamp with time zone,
state text,
issueid text,
summary text,
data json
);
