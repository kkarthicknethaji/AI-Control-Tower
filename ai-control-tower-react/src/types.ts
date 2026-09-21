export type Role = 'admin' | 'member' | 'readonly';
export type NavKey = 'command' | 'outcomes' | 'cost' | 'traces' | 'governance' | 'settings';

export interface CompanyMembership {
  company_id: string;
  role: Role;
  is_active: boolean;
  mt_companies?: { name?: string } | null;
}

export interface CompanyApp {
  app_id: string;
  app_name: string;
  supports_enforcement?: boolean;
}

export type ControlMode = 'enforceable' | 'monitor_only';
export type CredentialStatus = 'not_issued' | 'active' | 'expired';

export interface ConnectedApp {
  appId: string;
  name: string;
  isActive: boolean;
  grantedAt: string;
  supportsEnforcement: boolean;
  controlMode: ControlMode;
  hasCredential: boolean;
  credentialStatus: CredentialStatus;
  credentialCreatedAt: string | null;
  credentialLastUsedAt: string | null;
  credentialExpiresAt: string | null;
  credentialRevokedAt: string | null;
  scopeUsageWrite: boolean;
  scopeTracesWrite: boolean;
  scopePayloadsWrite: boolean;
  payloadCaptureEnabled: boolean;
}

export interface CaptureConfigInput {
  scopeUsageWrite: boolean;
  scopeTracesWrite: boolean;
  scopePayloadsWrite: boolean;
  payloadCaptureEnabled: boolean;
}

export interface MetricRow {
  label: string;
  value: string;
  detail: string;
  tone?: 'purple' | 'blue' | 'green' | 'amber' | 'red';
}

export interface RpcParams {
  companyId: string;
  appId: string;
  periodStart: string;
  periodEnd: string;
}
