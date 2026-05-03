export interface WeekendPassRecord {
  date: string;
  isoweek: number;
  status: string;
  region1: string;
  clusterName: string;
  reservationId: string;
  revenue: number;
  profit: number | null;
  utime: number;
  policyId: number;
}
