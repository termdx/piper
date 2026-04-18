import { Box, Text } from "ink";
import React from "react";
import type { Theme } from "../../../types";
import { ScrollableBox } from "./scrollablebox";

type BugItem = {
	id: number;
	title: string;
	priority: string;
	files: string;
	status: string;
	summary: string;
	impact: string;
};

const BUGS: BugItem[] = [
	{
		id: 1,
		title: "Body Editor Forces Key-Value Structure",
		priority: "P0",
		files: "src/ui/app/ui.tsx:110, src/ui/app/components/keyvaluefield.tsx",
		status: "Open",
		summary: "Body editing is limited to key-value JSON object pairs and cannot represent arrays or raw payloads.",
		impact: "Cannot send array bodies, raw text, XML, or non-object body formats."
	},
	{
		id: 2,
		title: "Double JSON Serialization in handleSend",
		priority: "P0",
		files: "src/ui/app/ui.tsx:154, src/ui/app/ui.tsx:161",
		status: "Open",
		summary: "Body is parsed as JSON and then stringified again before sending.",
		impact: "Non-JSON bodies fail with Invalid JSON and request is not sent."
	},
	{
		id: 3,
		title: "No Cursor Position in Text Input Dialogs",
		priority: "P1",
		files: "Formfield.tsx, keyvaluefield.tsx, exportdialog.tsx",
		status: "Open",
		summary: "Inputs only append text and delete from end; no cursor navigation.",
		impact: "Users cannot edit text in the middle of existing values."
	},
	{
		id: 4,
		title: "No URL Validation Before Sending",
		priority: "P1",
		files: "src/utils/request.ts:31, src/ui/app/ui.tsx:144-182",
		status: "Open",
		summary: "Malformed or empty URLs throw from URL constructor without friendly pre-validation.",
		impact: "Users see cryptic errors instead of clear URL validation feedback."
	},
	{
		id: 5,
		title: "Missing Content-Length and Content-Type Headers",
		priority: "P2",
		files: "src/utils/request.ts:43-49",
		status: "Open",
		summary: "Request body sends without explicit Content-Length or inferred Content-Type.",
		impact: "Some servers reject requests with missing/incorrect body headers."
	},
	{
		id: 10,
		title: "Export Dialog HOME Environment Variable May Be Undefined",
		priority: "P2",
		files: "src/ui/app/components/exportdialog.tsx:15",
		status: "Open",
		summary: "Export path relies on process.env.HOME which may not exist on all platforms.",
		impact: "Export can fail with invalid path like undefined/.postboy/exports."
	},
	{
		id: 6,
		title: "History Type Mismatch on Reload",
		priority: "P3",
		files: "src/ui/app/ui.tsx:195-196",
		status: "Open",
		summary: "History type expects object/string variants but persisted data is consistently string-based.",
		impact: "Dead code path and potential reload data inconsistency."
	},
	{
		id: 7,
		title: "Response Headers Display Can Crash",
		priority: "P3",
		files: "src/ui/app/components/responsepanel.tsx:115",
		status: "Open",
		summary: "Headers rendering blindly parses JSON and can throw on malformed values.",
		impact: "Response panel can crash when viewing headers tab."
	},
	{
		id: 8,
		title: "HTTP Methods Limited in Type but UI Supports More",
		priority: "P3",
		files: "src/types/index.ts:8, src/ui/app/ui.tsx:93",
		status: "Open",
		summary: "Type allows fewer HTTP methods than the UI currently exposes.",
		impact: "Type/runtime mismatch and potential TypeScript errors."
	},
	{
		id: 9,
		title: "History List Uses Unstable React Key",
		priority: "P3",
		files: "src/ui/app/components/historylist.tsx:129",
		status: "Open",
		summary: "timestamp is used as list key and can collide.",
		impact: "Rare React reconciliation/rendering issues in history list."
	}
];

export const BugsPanel = React.memo<{ theme: Theme }>(({ theme }) => {
	return (
		<ScrollableBox isActive>
			<Box flexDirection="column">
				{BUGS.map((bug) => (
					<Box key={bug.id} flexDirection="column" marginBottom={1} borderStyle="round" borderColor={theme.colors.muted} paddingX={1}>
						<Text color={theme.colors.accent} bold>{`[${bug.priority}] Bug ${bug.id}: ${bug.title}`}</Text>
						<Text color={theme.colors.white}>{`Files: ${bug.files}`}</Text>
						<Text color={theme.colors.primary}>{`Status: ${bug.status}`}</Text>
						<Text color={theme.colors.muted}>{bug.summary}</Text>
						<Text color={theme.colors.success}>{`Impact: ${bug.impact}`}</Text>
					</Box>
				))}
			</Box>
		</ScrollableBox>
	);
});
