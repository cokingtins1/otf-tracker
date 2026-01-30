import { google } from "googleapis";
import * as fs from "fs";
import * as readline from "readline";

const SCOPES = ["https://www.googleapis.com/auth/gmail.readonly"];
const TOKEN_PATH = "token.json";
const CREDENTIALS_PATH = "credentials.json";

async function authorize() {
	const credentials = JSON.parse(fs.readFileSync(CREDENTIALS_PATH, "utf-8"));
	const { client_secret, client_id, redirect_uris } =
		credentials.installed || credentials.web;

	const oAuth2Client = new google.auth.OAuth2(
		client_id,
		client_secret,
		redirect_uris[0]
	);

	// Check if we already have a token
	if (fs.existsSync(TOKEN_PATH)) {
		const token = JSON.parse(fs.readFileSync(TOKEN_PATH, "utf-8"));
		oAuth2Client.setCredentials(token);
		console.log("✅ Already authorized!");
		return oAuth2Client;
	}

	// Get new token
	const authUrl = oAuth2Client.generateAuthUrl({
		access_type: "offline",
		scope: SCOPES,
	});

	console.log("Authorize this app by visiting this url:", authUrl);

	const rl = readline.createInterface({
		input: process.stdin,
		output: process.stdout,
	});

	return new Promise((resolve) => {
		rl.question("Enter the code from that page here: ", (code) => {
			rl.close();
			oAuth2Client.getToken(code, (err, token) => {
				if (err) {
					console.error("Error retrieving access token", err);
					return;
				}
				oAuth2Client.setCredentials(token!);
				fs.writeFileSync(TOKEN_PATH, JSON.stringify(token));
				console.log("✅ Token stored to", TOKEN_PATH);
				resolve(oAuth2Client);
			});
		});
	});
}

// Test it by listing labels
async function main() {
	const auth = await authorize();
	const gmail = google.gmail({ version: "v1", auth });

	const res = await gmail.users.labels.list({ userId: "me" });
	console.log("📧 Your Gmail labels:");
	res.data.labels?.forEach((label) => {
		console.log(`  - ${label.name} (${label.id})`);
	});
}

main();
