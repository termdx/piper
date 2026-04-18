import React, { useState, useEffect, useCallback, useRef } from 'react';
import { Box, Text, useInput, useFocus, useApp } from 'ink';
import { historyManager } from '../../utils/history';
import { sendRequest, type DownloadProgress } from '../../utils/request';
import { themes } from './themes';
import { Spinner } from './components/spinner';
import { FormField } from './components/Formfield';
import { KeyValueField } from './components/keyvaluefield';
import { Tabs } from './components/tabcomps';
import type { HistoryEntry, PerformanceMetrics, Theme, ThemeColors } from '../../types';
import { HistoryList } from './components/historylist';
import { Footer } from './components/footer';
import { ThemeSelector } from './components/themeselector';
import { ResponsePanel } from './components/responsepanel';
import { ExportDialog } from './components/exportdialog';
import { themeManager } from '../../utils/themeManager';
import { MetricsPanel } from './components/metricspanel';
import { BugsPanel } from './components/bugspanel';

interface Request { method: "GET" | "POST" | "PUT" | "DELETE"; url: string; headers: string; body: string; }

const formatBytes = (bytes: number): string => {
	if (bytes === 0) return '0 B';
	const k = 1024;
	const sizes = ['B', 'KB', 'MB', 'GB'];
	const i = Math.floor(Math.log(bytes) / Math.log(k));
	return `${parseFloat((bytes / Math.pow(k, i)).toFixed(2))} ${sizes[i]}`;
};

const LiveByteCounter: React.FC<{ progress: DownloadProgress | null; theme: ThemeColors }> = ({ progress, theme }) => {
	const [pulseFrame, setPulseFrame] = useState(0);
	const pulseChars = ['⣾', '⣽', '⣻', '⢿', '⡿', '⣟', '⣯', '⣷'];
	const arrowFrames = ['↓', '⬇', '↓', '⇣'];

	useEffect(() => {
		const interval = setInterval(() => {
			setPulseFrame(prev => (prev + 1) % pulseChars.length);
		}, 100);
		return () => clearInterval(interval);
	}, []);

	if (!progress) return null;

	const { bytesReceived, totalBytes, speed } = progress;
	const percentage = totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * 100) : 0;
	const progressBarWidth = 20;
	const filledWidth = totalBytes > 0 ? Math.round((bytesReceived / totalBytes) * progressBarWidth) : 0;
	const filledBar = '█'.repeat(filledWidth);
	const emptyBar = '░'.repeat(progressBarWidth - filledWidth);

	return (
		<Box flexDirection="column" paddingX={1} paddingY={1} borderStyle="round" borderColor={theme.accent}>
			<Box marginBottom={1}>
				<Text color={theme.accent} bold>{pulseChars[pulseFrame]} </Text>
				<Text color={theme.primary} bold>DOWNLOADING </Text>
				<Text color={theme.accent}>{arrowFrames[pulseFrame % arrowFrames.length]}</Text>
			</Box>
			<Box>
				<Text color={theme.success}>{filledBar}</Text>
				<Text color={theme.muted} dimColor>{emptyBar}</Text>
				<Text color={theme.white} bold> {percentage}%</Text>
			</Box>
			<Box marginTop={1}>
				<Box marginRight={2}>
					<Text color={theme.accent}>📦 </Text>
					<Text color={theme.white} bold>{formatBytes(bytesReceived)}</Text>
					{totalBytes > 0 && (
						<Text color={theme.muted}> / {formatBytes(totalBytes)}</Text>
					)}
				</Box>
				<Box>
					<Text color={theme.success}>🚀 </Text>
					<Text color={theme.success} bold>{formatBytes(speed)}/s</Text>
				</Box>
			</Box>
		</Box>
	);
};




const SendButton: React.FC<{ onPress: () => void; loading: boolean; theme: ThemeColors }> = ({ onPress, loading, theme }) => {
	const { isFocused } = useFocus();
	useInput((_, key) => { if (isFocused && key.return) onPress(); });
	return (
		<Box borderStyle="round" paddingX={2} borderTopDimColor borderColor={isFocused ? theme.accent : theme.primary}>
			{loading ? <Spinner theme={theme} /> : <Text bold color={isFocused ? theme.accent : theme.white}>🚀 Send</Text>}
		</Box>
	);
};


const HTTP_METHODS = ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS", "HEAD"];
export const RequestPanel = React.memo<{
	request: Request;
	onMethodChange: (method: string) => void;
	onUrlChange: (url: string) => void;
	onHeadersChange: (headers: string) => void;
	onBodyChange: (body: string) => void;
	onSend: () => void;
	loading: boolean;
	theme: ThemeColors;
	historyUrls?: string[];
	onInputFocus?: (focused: boolean) => void;
}>(({ request, onMethodChange, onUrlChange, onHeadersChange, onBodyChange, onSend, loading, theme, historyUrls = [], onInputFocus }) => (
	<Box flexDirection="column" gap={1} flexGrow={1}>
		<FormField label="Method" value={request.method} onChange={onMethodChange} placeholder="GET" theme={theme} suggestions={HTTP_METHODS} onFocusChange={onInputFocus} />
		<FormField label="URL" value={request.url} onChange={onUrlChange} placeholder="https://api.example.com" theme={theme} suggestions={historyUrls} onFocusChange={onInputFocus} />
		<KeyValueField label="Headers" value={request.headers} onChange={onHeadersChange} placeholder="Press Enter to add headers" theme={theme} onFocusChange={onInputFocus} />
		<KeyValueField label="Body" value={request.body} onChange={onBodyChange} placeholder="Press Enter to add body" theme={theme} onFocusChange={onInputFocus} />
		<Box marginTop={1} justifyContent="center"><SendButton onPress={onSend} loading={loading} theme={theme} /></Box>
	</Box>
));





const UI = () => {
	const [theme, setTheme] = useState<Theme>(themes.catppuccin);
	const { exit } = useApp();
	const [activeTab, setActiveTab] = useState('request');
	const [request, setRequest] = useState<Request>({ method: 'GET', url: '', headers: '', body: '' });
	const [response, setResponse] = useState({ statustext: '', status: '', headers: '', body: '', error: '' });
	const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);
	const [history, setHistory] = useState<HistoryEntry[]>([]);
	const [loading, setLoading] = useState(false);
	const [downloadProgress, setDownloadProgress] = useState<DownloadProgress | null>(null);
	const requestRef = useRef(request);
	requestRef.current = request;

	useEffect(() => {
		const loadHistory = async () => setHistory((await historyManager.loadHistory()).entries);
		loadHistory();
	}, []);

	useEffect(() => {
		const loadTheme = async () => {
			const loadedTheme = await themeManager.loadCurrTheme();
			setTheme(loadedTheme);
		};
		loadTheme();
	}, []);
	const handleSend = useCallback(async () => {
		setLoading(true);
		setDownloadProgress(null);
		const startTime = Date.now();
		const currentRequest = requestRef.current;
		try {
			let parsedHeaders: Record<string, string> = {};
			let parsedBody: any;
			try {
				if (currentRequest.headers) parsedHeaders = JSON.parse(currentRequest.headers);
				if (currentRequest.body) parsedBody = JSON.parse(currentRequest.body);
			} catch (e: any) {
				setResponse({ status: 'Error', statustext: 'Invalid JSON', headers: '{}', body: e.message, error: e.message });
				setActiveTab('response');
				setLoading(false);
				return;
			}
			const reqBody = parsedBody ? JSON.stringify(parsedBody) : undefined;
			const res = await sendRequest({
				method: currentRequest.method,
				url: currentRequest.url,
				headers: parsedHeaders,
				body: reqBody,
				onProgress: (progress) => setDownloadProgress(progress),
			});
			const responseTime = Date.now() - startTime;
			await historyManager.addEntry({ ...currentRequest }, res.status, responseTime);
			setHistory((await historyManager.loadHistory()).entries);
			setMetrics(res.metrics);
			setResponse({ statustext: res.statusText, status: res.status.toString(), headers: JSON.stringify(res.headers), body: res.body, error: res.status >= 200 && res.status < 400 ? '' : `Error: ${res.statusText}` });
			setActiveTab('response');
		} catch (error: any) {
			setResponse({ status: 'Error', statustext: 'Request Failed', headers: '{}', body: error.message, error: error.message });
			setActiveTab('response');
		} finally {
			setLoading(false);
			setDownloadProgress(null);
		}
	}, []);


	const handleThemeChange = (theme: Theme) => {
		themeManager.ChangeTheme(theme)
		setTheme(theme);
	}


	const handleHistoryClick = useCallback((item: HistoryEntry) => {
		setRequest({
			method: item.method as Request['method'],
			url: item.url,
			headers: typeof item.headers === 'object' ? JSON.stringify(item.headers, null, 2) : item.headers || '',
			body: typeof item.body === 'object' ? JSON.stringify(item.body, null, 2) : item.body || ''
		});
		setActiveTab('request');
	}, []);

	const tabs = [{ name: 'request', label: 'Request' }, { name: 'response', label: 'Response' }, { name: 'bugs', label: 'Bugs' }]


	const activeIndex = tabs.findIndex(t => t.name === activeTab);

	const [showThemeSelector, setShowThemeSelector] = useState(false);
	const [showExportDialog, setShowExportDialog] = useState(false);
	const [inputFocused, setInputFocused] = useState(false);
	const [historySearching, setHistorySearching] = useState(false);

	useInput((input, key) => {
		if (input === 'q' && !showExportDialog) exit();
		if (key.ctrl && key.return) handleSend();
		if (key.ctrl && input === 'l') setActiveTab(tabs[(activeIndex + 1) % tabs.length]?.name ?? 'request');
		if (key.ctrl && input === 'h') setActiveTab(tabs[(activeIndex - 1 + tabs.length) % tabs.length]?.name ?? 'request');
		if (key.escape && showThemeSelector) setShowThemeSelector(false);
		if (key.escape && showExportDialog) setShowExportDialog(false);
		if ((input === 't' || input === 'T') && !key.ctrl && !key.meta && !inputFocused && !historySearching && !showExportDialog) setShowThemeSelector(prev => !prev);
		if ((input === 'e' || input === 'E') && !key.ctrl && !key.meta && !inputFocused && !historySearching && !showThemeSelector) setShowExportDialog(prev => !prev);
		if ((input === 'f' || input === 'F') && !key.ctrl && !key.meta && !inputFocused && !historySearching && !showThemeSelector && !showExportDialog) setHistorySearching(true);
	}, { isActive: !showExportDialog });

	const onMethodChange = useCallback((method: string) => setRequest(r => ({ ...r, method: method as Request['method'] })), []);
	const onUrlChange = useCallback((url: string) => setRequest(r => ({ ...r, url })), []);
	const onHeadersChange = useCallback((headers: string) => setRequest(r => ({ ...r, headers })), []);
	const onBodyChange = useCallback((body: string) => setRequest(r => ({ ...r, body })), []);

	// Gather unique URLs from history for autocomplete
	const historyUrls = Array.from(new Set(history.map(h => h.url))).filter(Boolean);

	return (
		<Box padding={1} flexDirection="column" flexGrow={1}>
			{showThemeSelector && (
				<Box flexDirection="row" justifyContent="center" marginBottom={1}>
					<ThemeSelector theme={theme} onThemeChange={(themeName) => { handleThemeChange(themes[themeName]) }} isActive={showThemeSelector} />
				</Box>
			)}
			{showExportDialog && (
				<Box flexDirection="row" justifyContent="center" marginBottom={1}>
					<ExportDialog request={request} onClose={() => setShowExportDialog(false)} theme={theme.colors as ThemeColors} />
				</Box>
			)}
			<Box alignSelf='center' marginBottom={1}>
				<Text color={theme.colors.accent} bold>
					{`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`}
				</Text>
			</Box>
			<Box alignSelf="center" marginBottom={1}>
				<Text color={theme.colors.primary} bold>
					{`┃   🛰️  Welcome to PostBoy — The Modern Terminal API Client   ┃`}
				</Text>
			</Box>
			<Box alignSelf="center" marginBottom={1}>
				<Text color={theme.colors.accent} bold>
					{`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`}
				</Text>
			</Box>
			<Box flexGrow={1}>
				<Box width="40%" borderColor={theme.colors.muted} flexDirection="column" marginRight={1}>
					<Box alignSelf='center' marginBottom={1}>
						<Text color={theme.colors.accent} bold>
							{`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`}
						</Text>
					</Box>
					<Box borderTopColor={'grey'} borderColor={theme.colors.secondary} paddingX={1} alignSelf="center">

						<Text color={theme.colors.accent} bold>📜 History</Text></Box>


					<Box flexDirection="column" flexGrow={1} borderRightColor={'grey'} borderTop={false} borderStyle={'round'} borderLeft={false} borderBottom={false} paddingY={1}>
						{history.length === 0 ? <Box padding={1}><Text color={theme.colors.muted}>No requests yet...</Text></Box> : (
							<HistoryList history={history} onItemClick={handleHistoryClick} theme={theme} onSearchingChange={setHistorySearching} startSearching={historySearching} />
						)}
					</Box>
					<Box flexDirection="column" borderStyle="round" borderColor={theme.colors.muted} marginX={1}>
						<Box alignSelf="center" paddingX={1}>
							<Text color={theme.colors.accent} bold>⚡ Metrics</Text>
						</Box>
						<MetricsPanel metrics={metrics} theme={theme} />
					</Box>
					<Box alignSelf="center" marginBottom={1}>
						<Text color={theme.colors.accent} bold>
							{`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`}
						</Text>
					</Box>
				</Box>
				<Box width="60%" borderColor={theme.colors.muted} padding={1} flexDirection="column">
					<Box alignSelf='center' marginBottom={1}>
						<Text color={theme.colors.accent} bold>
							{`┏━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┓`}
						</Text>
					</Box>
					<Tabs tabs={tabs} activeTab={activeTab} onChange={setActiveTab} theme={theme} />
					{downloadProgress && (
						<Box marginTop={1} justifyContent="center">
							<LiveByteCounter progress={downloadProgress} theme={theme.colors as ThemeColors} />
						</Box>
					)}
					<Box marginTop={1} flexDirection="column" flexGrow={1}>
						<Box display={activeTab === 'request' ? 'flex' : 'none'} flexGrow={1}>
							<RequestPanel request={request} onMethodChange={onMethodChange} onUrlChange={onUrlChange} onHeadersChange={onHeadersChange} onBodyChange={onBodyChange} onSend={handleSend} loading={loading} theme={theme.colors as ThemeColors} historyUrls={historyUrls} onInputFocus={setInputFocused} />
						</Box>
						<Box display={activeTab === 'response' ? 'flex' : 'none'} flexGrow={1}>
							<ResponsePanel response={response} theme={theme} />
						</Box>
						<Box display={activeTab === 'bugs' ? 'flex' : 'none'} flexGrow={1}>
							<BugsPanel theme={theme} />
						</Box>
					</Box>
					<Box alignSelf="center" marginBottom={1}>
						<Text color={theme.colors.accent} bold>
							{`┗━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━┛`}
						</Text>
					</Box>

				</Box>
			</Box>
			<Footer theme={theme.colors as ThemeColors} />
		</Box>
	);
};

export default UI;
