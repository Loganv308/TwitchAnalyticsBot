CREATE TABLE IF NOT EXISTS Streams (
        id TEXT PRIMARY KEY ,
        user_login TEXT,
        title TEXT,
        game_name TEXT,
        started_at TEXT,
        view_count INTEGER,
        user_id INTEGER
    );

CREATE TABLE IF NOT EXISTS Chat_messages (
    message_id TEXT PRIMARY KEY,
    id INTEGER,
    user_id INTEGER,
    username TEXT,
    message TEXT,
    timestamp TEXT,
    subscriber INTEGER,
    FOREIGN KEY (id) REFERENCES Streams(id)
);