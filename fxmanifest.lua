name 'ai-jobs'
author 'TGIANN'
version '0.1.2' -- x-release-please-version
license 'GPL-3.0-only'
description 'Work routes: taxi, bus, trucker, garbage, recycling, vineyard, diving'
repository 'https://github.com/aifivem/ai-jobs'
fx_version 'cerulean'
game 'gta5'
node_version '22'

client_script 'dist/client.js'
server_script 'dist/server.js'


dependencies {
	'/onesync',
	'ai-core',
}

files {
	'locales/*.json',
	'data/routes.json',
	'data/stops.json',
	'data/hotdog.json',
}
