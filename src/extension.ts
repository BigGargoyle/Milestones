// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as fs from 'fs';
import * as vscode from 'vscode';



const key = 'milestones';
const milestoneKeyword = 'MILESTONE';
const milestoneKeywordDone = 'DONE';

enum MilestoneState {
	NOT_STARTED = 0,
	IN_PROGRESS = 1,
	DONE = 2
}

function milestoneStateToString(state: MilestoneState): string {
    switch (state) {
        case MilestoneState.NOT_STARTED:
            return 'NOT_STARTED';
        case MilestoneState.IN_PROGRESS:
            return 'IN_PROGRESS';
        case MilestoneState.DONE:
            return 'DONE       ';
        default:
            return 'Unknown';
    }
}

function formatDate(date: Date): string {
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0'); // Months are zero-based
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

class Milestone {

	name: string;
	date: Date;
	state: MilestoneState;
	filePath: string | undefined;
	lineNumber: number;

	constructor(name:string, date:Date) {
		this.name = name;
		this.date = date;
		this.state = MilestoneState.NOT_STARTED;
		this.filePath = undefined;
		this.lineNumber = -1;
	}

	setFilePath(filePath:string) {
		this.filePath = filePath;
	}

	setLineNumber(lineNumber:number) {
		this.lineNumber = lineNumber;
	}
}

class MilestoneTreeItem extends vscode.TreeItem {
    constructor(
        public readonly milestone: Milestone,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
		const label = formatDate(milestone.date) + '\t' + milestone.name ;
        super(label, collapsibleState);
        this.contextValue = 'milestone';
        switch (milestone.state) {
            case MilestoneState.NOT_STARTED:
                console.log(__dirname+'/icons/cross.svg');
                this.iconPath = vscode.Uri.file(__dirname + '/../icons/cross.svg');
                break;
            case MilestoneState.IN_PROGRESS:
                console.log(__dirname+'/icons/cross.svg');
                this.iconPath = vscode.Uri.file(__dirname + '/../icons/pencil.svg');
                break;
            case MilestoneState.DONE:
                console.log(__dirname+'/icons/cross.svg');
                this.iconPath = vscode.Uri.file(__dirname + '/../icons/done.svg');
                break;
        }
    }
}

class MilestoneTreeDataProvider implements vscode.TreeDataProvider<MilestoneTreeItem> {
	private _onDidChangeTreeData: vscode.EventEmitter<MilestoneTreeItem | undefined> = new vscode.EventEmitter<MilestoneTreeItem | undefined>();
	readonly onDidChangeTreeData: vscode.Event<MilestoneTreeItem | undefined> = this._onDidChangeTreeData.event;

    constructor(private milestones: Milestone[]) {
        vscode.commands.registerCommand('milestones.onItemClicked', (item: MilestoneTreeItem) => this.onItemClicked(item));
    }

    getTreeItem(element: MilestoneTreeItem): vscode.TreeItem {
        let title = element.label ? element.label.toString() : '';
        let result = new MilestoneTreeItem(element.milestone, element.collapsibleState);
        result.command = {
            command: 'milestones.onItemClicked',
            title: title,
            arguments: [element],
        };
        return result;
    }

    getChildren(element?: MilestoneTreeItem): Thenable<MilestoneTreeItem[]> {
        if (element) {
            // Return children of the milestone if any
            return Promise.resolve([]);
        } else {
            // Return root milestones
            return Promise.resolve(this.milestones.map(milestone => new MilestoneTreeItem(milestone, vscode.TreeItemCollapsibleState.None)));
        }
    }

	refresh(): void {
		this._onDidChangeTreeData.fire(undefined);
	}

	sortByDate(): void {
        this.milestones.sort((a, b) => a.date.getTime() - b.date.getTime());
        this.refresh();
    }

    sortByState(): void {
        this.sortByDate();
        this.milestones.sort((a, b) => a.state - b.state);
        this.refresh();
    }

    public onItemClicked(item: MilestoneTreeItem): void {
        if (item.milestone.state === MilestoneState.NOT_STARTED || item.milestone.filePath === undefined) {
            return;
        }
        const file = vscode.Uri.file(item.milestone.filePath);
        vscode.window.showTextDocument(file).then(editor => {
            const range = editor.document.lineAt(item.milestone.lineNumber).range;
            editor.selection = new vscode.Selection(range.end, range.end);
            editor.revealRange(range);
        });
    }
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export async function activate(context: vscode.ExtensionContext) {

	let serializedMilestones: string | undefined = context.globalState.get<string>(key);
    let milestones: Milestone[];

    if (serializedMilestones === undefined) {
        milestones = [];
        context.globalState.update(key, JSON.stringify(milestones));
    } else {
        try {
            //let jsonMilestones = JSON.parse(serializedMilestones);
            if (Array.isArray(serializedMilestones)) {
                milestones = serializedMilestones.map((obj: any) => {
                    let milestone = new Milestone(obj.name, new Date(obj.date));
                    milestone.state = obj.state;
                    milestone.lineNumber = obj.lineNumber;
                    return milestone;
                });
            } else if (typeof serializedMilestones === 'string') {
				milestones = JSON.parse(serializedMilestones).map((obj: any) => {
					let milestone = new Milestone(obj.name, new Date(obj.date));
					milestone.state = obj.state;
					milestone.lineNumber = obj.lineNumber;
					return milestone;
				});

			} else {
                throw new Error('Parsed data is not an array');
            }
        } catch (error) {
            console.error('Failed to parse milestones:', error);
            milestones = [];
        }
    }

	
	// create tree view
	const milestoneTreeDataProvider = new MilestoneTreeDataProvider(milestones);
	vscode.window.registerTreeDataProvider('milestoneTreeView', milestoneTreeDataProvider);

	// Register the sortMilestonesByDate command
    const sortMilestonesByDateDisposable = vscode.commands.registerCommand('milestones.sortMilestonesByDate', () => {
        milestoneTreeDataProvider.sortByDate();
    });

    const sortMilestonesByStateDisposable = vscode.commands.registerCommand('milestones.sortMilestonesByState', () => {
        milestoneTreeDataProvider.sortByState();
    });


	const addMilestoneDisposable = vscode.commands.registerCommand('milestones.addMilestone', async () => {
		const name = await vscode.window.showInputBox({ prompt: 'Enter milestone name' });
		if (!name) {
			return;
		}

        if(milestones.find(milestone => milestone.name === name)) {
            vscode.window.showErrorMessage('Milestone with the same name already exists.');
            return;
        }

        if(name.includes(milestoneKeyword)) {
            vscode.window.showErrorMessage('Milestone name cannot contain the keyword.');
            return;
        }

        if (name.includes(' ') || name.includes('\t') || name.includes('\n') || name.includes('\r')) {
            vscode.window.showErrorMessage('Milestone name cannot contain whitespace.');
            return;
        }

		const dateInput = await vscode.window.showInputBox({ prompt: 'Enter milestone date (dd.mm.yyyy)' });
		if (!dateInput) {
			return;
		}

		const dateParts = dateInput.split('.');
        if (dateParts.length !== 3) {
            vscode.window.showErrorMessage('Invalid date format. Please use dd.mm.yyyy.');
            return;
        }

        const day = parseInt(dateParts[0], 10);
        const month = parseInt(dateParts[1], 10) - 1; // Months are zero-based
        const year = parseInt(dateParts[2], 10);

        if (isNaN(day) || isNaN(month) || isNaN(year)) {
            vscode.window.showErrorMessage('Invalid date format. Please use dd.mm.yyyy.');
            return;
        }

        if (day < 1 || day > 31 || month < 0 || month > 11) {
            vscode.window.showErrorMessage('Invalid date format. Please use dd.mm.yyyy.');
            return;
        }

        const date = new Date(year, month, day);
        if (isNaN(date.getTime())) {
            vscode.window.showErrorMessage('Invalid date format. Please use dd.mm.yyyy.');
            return;
        }

		const newMilestone = new Milestone(name, date);
		milestones.push(newMilestone);
		context.globalState.update(key, milestones);
		milestoneTreeDataProvider.refresh();
	});
	context.subscriptions.push(addMilestoneDisposable);

	// Find files containing milestone keyword and update milestones
    const milestoneKeywordLines = await findFilesContainingMilestoneKeyword();
    const milestoneToLineMap = cleanAndParseText(milestoneKeywordLines);

    // Update milestones with file path and line number
    updateMilestones(milestones, milestoneToLineMap);
    milestoneTreeDataProvider.refresh();


    const onDidSaveTextDocumentDisposable = vscode.workspace.onDidSaveTextDocument(async (document) => {
        clearFileInfo(milestones, document.uri.fsPath);
        const milestoneKeywordLinesFromSavedFile = new Array<MilestoneKeywordLine>();
        processFile(document.uri, milestoneKeywordLinesFromSavedFile);
        const milestoneToLineMapFromSavedFile = cleanAndParseText(milestoneKeywordLinesFromSavedFile);
        updateMilestones(milestones, milestoneToLineMapFromSavedFile);
        milestoneTreeDataProvider.refresh();
    });
    context.subscriptions.push(onDidSaveTextDocumentDisposable);

    const deleteMilestoneDisposable = vscode.commands.registerCommand('milestones.deleteMilestone', async (item: MilestoneTreeItem) => {
        const index = milestones.indexOf(item.milestone);
        if (index >= 0) {
            milestones.splice(index, 1);
            context.globalState.update(key, JSON.stringify(milestones));
            milestoneTreeDataProvider.refresh();
        }
    });
    context.subscriptions.push(deleteMilestoneDisposable);

    const changeDateDisposable = vscode.commands.registerCommand('milestones.changeDate', async (item: MilestoneTreeItem) => {
        const dateInput = await vscode.window.showInputBox({ prompt: 'Enter new date (YYYY-MM-DD)' });
        if (!dateInput) {
            return;
        }

        const date = new Date(dateInput);
        if (isNaN(date.getTime())) {
            vscode.window.showErrorMessage('Invalid date format. Please use YYYY-MM-DD.');
            return;
        }

        item.milestone.date = date;
        context.globalState.update(key, JSON.stringify(milestones));
        milestoneTreeDataProvider.refresh();
    });
    context.subscriptions.push(changeDateDisposable);

    const markAsDoneDisposable = vscode.commands.registerCommand('milestones.markDone', async (item: MilestoneTreeItem) => {
        item.milestone.state = item.milestone.state === MilestoneState.DONE ? MilestoneState.NOT_STARTED : MilestoneState.DONE;
        context.globalState.update(key, JSON.stringify(milestones));
        milestoneTreeDataProvider.refresh();
    });
    context.subscriptions.push(markAsDoneDisposable);
}

class MilestoneKeywordLine {
	constructor(public readonly lineNumber: number, public readonly text: string, public readonly filePath: string, public isDone: boolean) {}
}

async function findFilesContainingMilestoneKeyword() : Promise<Array<MilestoneKeywordLine>> {
	const milestoneKeywordLines: Array<MilestoneKeywordLine> = [];
	const files = await vscode.workspace.findFiles('**/*', '**/node_modules/**');
	for (const file of files) {
		processFile(file, milestoneKeywordLines);
	}
	return milestoneKeywordLines;
}

function processFile(file : vscode.Uri, milestoneKeywordLines: Array<MilestoneKeywordLine>) {
    const text = fs.readFileSync(file.fsPath, 'utf-8');
    const lines = text.split('\n');
    for (let i = 0; i < lines.length; i++) {
        if (lines[i].includes(milestoneKeyword)) {
            milestoneKeywordLines.push(new MilestoneKeywordLine(i, lines[i], file.fsPath, false));
        }
    }
}

function cleanAndParseText(lines: MilestoneKeywordLine[]): Map<string, MilestoneKeywordLine> {
    const milestoneToLineMap = new Map<string, MilestoneKeywordLine>();
    for (const line of lines) {
        const cleanedText = line.text.replace(/[\r\n]/g, '').trim();
        const parts = cleanedText.split(' ');
        for (let i = 0; i < parts.length; i++) {
            if (parts[i] === milestoneKeyword) {
                if (i + 1 >= parts.length) {
                    continue;
                }
                const name = parts[i + 1];
                if (i + 2 < parts.length && parts[i + 2] === milestoneKeywordDone) {
                    line.isDone = true;
                }
                milestoneToLineMap.set(name, line);
            }
        }
    }
    return milestoneToLineMap;
}

function updateMilestones(milestones: Milestone[], milestoneToLineMap: Map<string, MilestoneKeywordLine>): void {
    for (const milestone of milestones) {
        const line = milestoneToLineMap.get(milestone.name);
        if (line) {
            milestone.filePath = line.filePath;
            milestone.lineNumber = line.lineNumber;
            milestone.state = line.isDone ? MilestoneState.DONE : MilestoneState.IN_PROGRESS;
        }
    }
}

function clearFileInfo(milestones: Milestone[], fsPath:string): void {
    for (const milestone of milestones) {
        if (milestone.filePath === fsPath) {
            milestone.state = MilestoneState.NOT_STARTED;
            milestone.filePath = undefined;
            milestone.lineNumber = -1;
        }
    }
}

// This method is called when your extension is deactivated
export function deactivate() {}
