import { TFile } from "obsidian";
import { IdService } from "./id-service";
import moment from "moment";

export type FileStatus =
  | "queued"
  | "processing"
  | "completed"
  | "error"
  | "bypassed";

export enum Action {
  CLEANUP = "Cleaning up file...",
  CLEANUP_DONE = "File cleaned up",
  RENAME = "Renaming file...",
  RENAME_DONE = "File renamed",
  EXTRACT = "Extracting content...",
  EXTRACT_DONE = "Content extracted",
  MOVING_ATTACHMENT = "Moving attachments...",
  MOVING_ATTACHEMENT_DONE = "Attachments moved",
  CLASSIFY = "Analyzing document type...",
  CLASSIFY_DONE = "Document type identified",
  TAGGING = "Generating tags...",
  TAGGING_DONE = "Tags generated",
  APPLYING_TAGS = "Applying tags...",
  APPLYING_TAGS_DONE = "Tags applied",
  RECOMMEND_NAME = "Generating file name...",
  RECOMMEND_NAME_DONE = "File name generated",
  CONTAINER = "Creating document container...",
  APPEND = "Appending content...",
  APPEND_DONE = "Content appended",
  ERROR_APPEND = "Failed to append content",
  ERROR_COMPLETE = "Processing failed",
  ERROR_VALIDATE = "Failed to validate document",
  ERROR_CONTAINER = "Failed to create container",
  CONTAINER_DONE = "Container created",
  APPLYING_NAME = "Applying new name...",
  APPLYING_NAME_DONE = "New name applied",
  FORMATTING = "Formatting content...",
  FORMATTING_DONE = "Content formatted",
  MOVING = "Moving to final location...",
  MOVING_DONE = "File moved successfully",
  COMPLETED = "Processing completed",
  VALIDATE = "Validating document...",
  VALIDATE_DONE = "Document validated",
  ERROR_CLEANUP = "Failed to clean up file",
  ERROR_RENAME = "Failed to rename file",
  ERROR_EXTRACT = "Failed to extract content",
  ERROR_MOVING_ATTACHMENT = "Failed to move attachments",
  ERROR_CLASSIFY = "Failed to analyze document type",
  ERROR_TAGGING = "Failed to generate tags",
  ERROR_FORMATTING = "Failed to format content",
  ERROR_MOVING = "Failed to move file",
}

export interface LogEntry {
  timestamp: string;
  completed?: boolean;
  error?: {
    message: string;
    stack?: string;
    action: Action;
  };
}

export interface FileRecord {
  id: string;
  tags: string[];
  classification?: string;
  formatted: boolean;
  newPath?: string;
  newName?: string;
  originalName: string;
  logs: Record<Action, LogEntry>;
  status: FileStatus;
  file: TFile | null;
}

export class RecordManager {
  private static instance: RecordManager;
  private records: Map<string, FileRecord> = new Map();
  private idService: IdService;

  private constructor() {
    this.idService = IdService.getInstance();
  }

  public static getInstance(): RecordManager {
    if (!RecordManager.instance) {
      RecordManager.instance = new RecordManager();
    }
    return RecordManager.instance;
  }

  public startTracking(hash: string, originalName: string): string {
    if (!this.records.has(hash)) {
      this.records.set(hash, {
        id: hash,
        file: null,
        tags: [],
        formatted: false,
        logs: {} as Record<Action, LogEntry>,
        status: "queued",
        originalName,
      });
    }
    return hash;
  }

  public setFile(hash: string, file: TFile): void {
    const record = this.records.get(hash);
    if (record) {
      record.file = file;
    }
  }

  public setStatus(hash: string, status: FileStatus): void {
    const record = this.records.get(hash);
    if (record) {
      record.status = status;
    }
  }

  public addAction(hash: string, step: Action, completed = false): void {
    const record = this.records.get(hash);
    if (record) {
      // For completed actions, find and update the corresponding in-progress action
      if (completed) {
        const baseAction = this.getBaseAction(step);
        if (baseAction && record.logs[baseAction]) {
          record.logs[baseAction].completed = true;
          return;
        }
      }

      // For new actions, add them as in-progress
      record.logs[step] = {
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
        completed,
      };
    }
  }

  private getBaseAction(completedStep: Action): Action | undefined {
    const reverseMap: Partial<Record<Action, Action>> = {
      [Action.CLEANUP_DONE]: Action.CLEANUP,
      [Action.RENAME_DONE]: Action.RENAME,
      [Action.EXTRACT_DONE]: Action.EXTRACT,
      [Action.MOVING_ATTACHEMENT_DONE]: Action.MOVING_ATTACHMENT,
      [Action.CLASSIFY_DONE]: Action.CLASSIFY,
      [Action.TAGGING_DONE]: Action.TAGGING,
      [Action.APPLYING_TAGS_DONE]: Action.APPLYING_TAGS,
      [Action.RECOMMEND_NAME_DONE]: Action.RECOMMEND_NAME,
      [Action.APPLYING_NAME_DONE]: Action.APPLYING_NAME,
      [Action.FORMATTING_DONE]: Action.FORMATTING,
      [Action.MOVING_DONE]: Action.MOVING,
    };
    return reverseMap[completedStep];
  }

  // Record update methods
  public addTag(hash: string, tag: string): void {
    const record = this.records.get(hash);
    if (record && !record.tags.includes(tag)) {
      record.tags.push(tag);
    }
  }

  public setTags(hash: string, tags: string[]): void {
    const record = this.records.get(hash);
    if (record) {
      record.tags = tags;
    }
  }

  public setClassification(hash: string, classification: string): void {
    const record = this.records.get(hash);
    if (record) {
      record.classification = classification;
    }
  }

  public setFormatted(hash: string, formatted: boolean): void {
    const record = this.records.get(hash);
    if (record) {
      record.formatted = formatted;
    }
  }

  public setNewPath(hash: string, newPath: string): void {
    const record = this.records.get(hash);
    if (record) {
      record.newPath = newPath;
    }
  }

  public setNewName(hash: string, newName: string): void {
    const record = this.records.get(hash);
    if (record) {
      record.newName = newName;
    }
  }

  // Logging methods
  // Query methods
  public getRecord(hash: string): FileRecord | undefined {
    return this.records.get(hash);
  }

  public hasErrors(hash: string, step?: Action): boolean {
    const record = this.records.get(hash);
    if (!record) return false;

    if (step) {
      return !!record.logs[step]?.error;
    }

    return Object.values(record.logs).some(log => !!log.error);
  }

  public getStepLogs(hash: string, step: Action): LogEntry | undefined {
    const record = this.records.get(hash);
    if (!record) return undefined;
    return record.logs[step];
  }

  public getLastStep(hash: string): Action | null {
    const record = this.records.get(hash);
    if (!record) return null;

    const steps = Object.entries(record.logs);
    if (steps.length === 0) return null;

    return steps.reduce((latest, [action, log]) => {
      if (
        !latest ||
        moment(log.timestamp).isAfter(moment(record.logs[latest].timestamp))
      ) {
        return action as Action;
      }
      return latest;
    }, null as Action | null);
  }

  // Query methods for multiple records
  public getAllRecords(): FileRecord[] {
    return Array.from(this.records.values());
  }

  public getRecordsWithErrors(): FileRecord[] {
    return this.getAllRecords().filter(record =>
      Object.values(record.logs).some(log => !!log.error)
    );
  }

  public getRecordsByStep(step: Action): FileRecord[] {
    return this.getAllRecords().filter(record => !!record.logs[step]);
  }

  public addError(
    hash: string,
    error: { action: Action; message: string; stack?: string }
  ): void {
    const record = this.records.get(hash);
    if (record) {
      record.logs[error.action] = {
        timestamp: moment().format("YYYY-MM-DD HH:mm:ss"),
        completed: false,
        error: {
          message: error.message,
          stack: error.stack,
          action: error.action,
        },
      };
    }
  }

  public getStepErrors(
    hash: string
  ): Array<{ action: Action; error: LogEntry["error"] }> {
    const record = this.records.get(hash);
    if (!record) return [];

    return Object.entries(record.logs)
      .filter(([_, log]) => log.error)
      .map(([action, log]) => ({
        action: action as Action,
        error: log.error,
      }));
  }

  public getLastError(
    hash: string
  ): { action: Action; error: LogEntry["error"] } | null {
    const errors = this.getStepErrors(hash);
    return errors.length > 0 ? errors[errors.length - 1] : null;
  }
}
