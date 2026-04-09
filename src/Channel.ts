export class Channel {
  private id: string;
  private title: string;
  private game_name: string;
  private started_at: string | null;
  private viewer_count: number;
  private user_id: string | null;
  private user_login: string;
 
  constructor(
    id: string                = "",
    title: string             = "",
    game: string              = "",
    started_at: string | null = null,
    viewer_count: number      = 0,
    user_id: string | null    = null,
    user_login: string        = ""
  ) {
    this.id           = id;
    this.title        = title;
    this.game_name    = game;
    this.started_at   = started_at;
    this.viewer_count = viewer_count;
    this.user_id      = user_id;
    this.user_login   = user_login;
  }
 
  // Gets the data from the channel
  getChannelsData(): void {}
  getStreamID(): string         { return this.id; }
  getTitle(): string            { return this.title; }
  getGame(): string             { return this.game_name; } // fixed: was returning this.game (undefined)
  getStartTime(): string | null { return this.started_at; }
  getViewerCount(): number      { return this.viewer_count; }
  getUserID(): string | null    { return this.user_id; }
  getUserLogin(): string        { return this.user_login; }
}
 