export class Channel {
    // Passes Database properties into this class upon initialization. 
    constructor(
        id = "", 
        title = "", 
        game = "", 
        started_at = null, 
        viewer_count = 0, 
        user_id = null, 
        user_login = ""
    ) {
        this.id = id;
        this.title = title;
        this.game_name = game;
        this.started_at = started_at;
        this.viewer_count = viewer_count;
        this.user_id = user_id;
        this.user_login = user_login;
    }

    // Gets the data from the channel
    getChannelsData(){

    }
    
    // Without these getters, there isn't a good way (that I know of) to access the StreamID value which is needed for other tables in the Database. 
    getStreamID() {
        return this.id;
    }

    getTitle() {
        return this.title;
    }

    getGame() {
        return this.game;
    }

    getStartTime() {
        return this.started_at;
    }

    getViewerCount() {
        return this.viewer_count;
    }

    getUserID() {
        return this.user_id;
    }

    getUserLogin() {
        return this.user_login;
    }
}