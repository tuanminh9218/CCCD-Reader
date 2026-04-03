export interface CCCDInfo {
  idNumber: string;
  issueDate: string;
  fullName: string;
  dateOfBirth: string;
  gender: string;
  hometown: string;
  permanentResidence: string;
}

export interface ExtractionResult {
  data: CCCDInfo | null;
  error?: string;
}
