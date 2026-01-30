import { google, gmail_v1 } from "googleapis";
import { getOAuth2Client } from "../auth/google";

export async function fetchOTFMessages(accessToken: string) {
	const oauth2Client = getOAuth2Client();
	oauth2Client.setCredentials({ access_token: accessToken });

	const gmail = google.gmail({ version: "v1", auth: oauth2Client });

	// Get OTF label ID
	const labelsResponse = await gmail.users.labels.list({ userId: "me" });
	const otfLabel = labelsResponse.data.labels?.find(
		(label) => label.name === "OTF"
	);

	if (!otfLabel) {
		throw new Error("OTF label not found in Gmail");
	}

	// Fetch messages with OTF label
	const messagesResponse = await gmail.users.messages.list({
		userId: "me",
		labelIds: [otfLabel.id!],
		maxResults: 500, // Adjust as needed
	});

	const messages = messagesResponse.data.messages || [];

	// Fetch full message details (including HTML body)
	const fullMessages = await Promise.all(
		messages.map(async (msg) => {
			const fullMsg = await gmail.users.messages.get({
				userId: "me",
				id: msg.id!,
				format: "full",
			});
			return fullMsg.data;
		})
	);

	return fullMessages;
}

export function extractHtmlFromMessage(message: gmail_v1.Schema$Message): string | null {
	const payload = message.payload;

	// Check if body has data (simple message)
	if (payload?.body?.data) {
		return Buffer.from(payload.body.data, "base64").toString("utf-8");
	}

	// Check parts (multipart message)
	if (payload?.parts) {
		const htmlPart = payload.parts.find(
			(part) => part.mimeType === "text/html"
		);
		if (htmlPart?.body?.data) {
			return Buffer.from(htmlPart.body.data, "base64").toString("utf-8");
		}

		// Check nested parts
		for (const part of payload.parts) {
			if (part.parts) {
				const nestedHtmlPart = part.parts.find(
					(nested) => nested.mimeType === "text/html"
				);
				if (nestedHtmlPart?.body?.data) {
					return Buffer.from(
						nestedHtmlPart.body.data,
						"base64"
					).toString("utf-8");
				}
			}
		}
	}

	return null;
}

export function extractDateFromMessage(message: gmail_v1.Schema$Message): Date {
	const dateHeader = message.payload?.headers?.find(
		(h) => h.name?.toLowerCase() === "date"
	);
	return new Date(dateHeader?.value || message.internalDate || Date.now());
}
