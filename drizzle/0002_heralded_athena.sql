CREATE TABLE "applications" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "name" varchar(100) NOT NULL,
    "client_id" varchar(100) NOT NULL,
    "client_secret" varchar(100) NOT NULL,
    "redirect_uri" text NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL,
    "updated_at" timestamp
);

CREATE TABLE "auth_codes" (
    "id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
    "code" text NOT NULL,
    "application_id" uuid NOT NULL REFERENCES "applications"("id") ON DELETE CASCADE,
    "user_id" uuid NOT NULL REFERENCES "users"("id") ON DELETE CASCADE,
    "expires_at" timestamp NOT NULL,
    "created_at" timestamp DEFAULT now() NOT NULL
);

CREATE UNIQUE INDEX "applications_client_id_key" ON "applications" ("client_id");
CREATE UNIQUE INDEX "auth_codes_code_key" ON "auth_codes" ("code");
