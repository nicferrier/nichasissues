create sequence if not exists issue_id;

create table if not exists issue (
id integer,
issueid text,
summary text,
data json
);
