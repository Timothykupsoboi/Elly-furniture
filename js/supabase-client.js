(function (window) {
    const CDN = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";

    const Supa = {
        client: null,
        inited: false,

        async _loadSdk() {
            if (window.supabase) return;

            return new Promise((resolve, reject) => {
                const script = document.createElement("script");
                script.src = CDN;
                script.async = true;

                script.onload = () => {
                    console.info("Supabase SDK loaded successfully.");
                    resolve();
                };
                script.onerror = () =>
                    reject(new Error("Supabase SDK failed to load. Please check network connection."));

                document.head.appendChild(script);
            });
        },

        async init() {
            if (this.inited) return this.client;

            const u = window.SUPABASE_URL;
            const k = window.SUPABASE_ANON_KEY;

            if (!u || !k) {
                throw new Error('Supabase URL and Anon Key are required. Make sure js/supabase-config.js is loaded.');
            }

            await this._loadSdk();

            this.client = window.supabase.createClient(u, k, {
                auth: {
                    persistSession: true,
                    autoRefreshToken: true,
                    detectSessionInUrl: true
                }
            });
            this.inited = true;
            console.info("Supabase Client initialized successfully.");
            return this.client;
        },

        _require() {
            if (!this.inited) {
                throw new Error("Supabase is not initialized. Call Supa.init() first.");
            }
        },

        async fetchAll(table) {
            this._require();
            const { data, error } = await this.client.from(table).select("*");
            if (error) throw error;
            return data;
        },

        async fetchById(table, id) {
            this._require();
            const { data, error } = await this.client.from(table).select("*").eq("id", id).maybeSingle();
            if (error) throw error;
            return data;
        },

        async insert(table, rows) {
            this._require();
            const payload = Array.isArray(rows) ? rows : [rows];
            const { data, error } = await this.client.from(table).insert(payload).select();
            if (error) throw error;
            return data;
        },

        async upsert(table, rows, conflictKey = "id") {
            this._require();
            const payload = Array.isArray(rows) ? rows : [rows];
            const { data, error } = await this.client.from(table).upsert(payload, { onConflict: conflictKey }).select();
            if (error) throw error;
            return data;
        },

        async update(table, id, updates) {
            this._require();
            const { data, error } = await this.client.from(table).update(updates).eq("id", id).select();
            if (error) throw error;
            return data;
        },

        async delete(table, id) {
            this._require();
            const { data, error } = await this.client.from(table).delete().eq("id", id).select();
            if (error) throw error;
            return data;
        }
    };

    window.Supa = Supa;
})(window);
