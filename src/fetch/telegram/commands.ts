/* Command constants */
// douyin about
export const COMMAND_ADD_DYUSER = 'adddy';
export const COMMAND_REMOVE_DYUSER = 'rmdy';
export const COMMAND_LIST_DYUSER = 'lsdy';
// bilibili about
export const COMMAND_BL_ADD_STREAMER = 'bladd';
export const COMMAND_BL_REMOVE_STREAMER = 'blrm';
export const COMMAND_BL_LIST_STREAMER = 'blls';
// other
export const COMMAND_LIST_ALLUSER = 'lsall';

// Export a unified commands list for Telegram's setMyCommands
export const COMMANDS = [
    { command: COMMAND_BL_ADD_STREAMER, description: 'Add a Bilibili streamer: /bladd <uid>[,<uid>,...]' },
    { command: COMMAND_BL_REMOVE_STREAMER, description: 'Remove a Bilibili streamer: /blrm <uid>[,<uid>,...]' },
    { command: COMMAND_BL_LIST_STREAMER, description: 'List Bilibili streamers' },

    { command: COMMAND_ADD_DYUSER, description: 'Add a Douyin user: /adddy <sec_uid>' },
    { command: COMMAND_REMOVE_DYUSER, description: 'Remove a Douyin user: /rmdy <sec_uid>' },
    { command: COMMAND_LIST_DYUSER, description: 'List Douyin users' },

    { command: COMMAND_LIST_ALLUSER, description: 'List all tracked users (all platforms)' },
];

export default COMMANDS;
