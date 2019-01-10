SELECT create_or_replace_hook(
  'public', 'log', 'normalize_for_user', 'user_normalize_hook' 
);
