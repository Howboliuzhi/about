
export type LogStatus = 'pending' | 'success' | 'error' | 'final' | 'info';

export interface LogEntry {
  key: number;
  message: string;
  status: LogStatus;
}
