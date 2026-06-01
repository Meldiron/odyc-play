export enum Dependencies {
	USER = 'dependency:user',
	PROFILE = 'dependency:profile',
	GAMES = 'dependency:games',
	HIGHLIGHTS = 'dependency:highlights',
	PROFILES = 'dependency:profiles',
	APPS = 'dependency:apps',
	APP = 'dependency:app'
}

// Appwrite connection (single source of truth)
export const APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1';
export const APPWRITE_PROJECT = 'odyc-play';
export const OAUTH2_BASE = `${APPWRITE_ENDPOINT}/oauth2/${APPWRITE_PROJECT}`;

export const DefaultProfilePicture = `
  99999999
  55555555
  53355335
  53355335
  55555555
  55655655
  55566555
  55555555
	`;

export const OdycColorsHEX = [
	'#212529', //black
	'#f8f9fa', //white
	'#ced4da', //gray
	'#228be6', //blue
	'#fa5252', //red
	'#fcc419', //yellow
	'#ff922b', //orange
	'#40c057', //green
	'#f06595', //pink
	'#a52f01' //brown,
];

export const OdycColorsRGB = [
	[33, 37, 41],
	[248, 249, 250],
	[206, 212, 218],
	[34, 139, 230],
	[250, 82, 82],
	[252, 196, 25],
	[255, 146, 43],
	[64, 192, 87],
	[240, 101, 149],
	[165, 47, 1]
];

export const DefaultCode = `const game = createGame({
	player: {
		sprite: \`
			...00...
			...00...
			.000000.
			0.0000.0
			0.0000.0
			..0000..
			..0..0..
			..0..0..
			\`,
		position: [3, 1]
	},
	templates: {
		x: {
			sprite: 2
		}
	},
	map: \`
	xxxxxxxx
	x......x
	x......x
	x......x
	x......x
	x......x
	x......x
	xxxxxxxx
	\`
});`;
