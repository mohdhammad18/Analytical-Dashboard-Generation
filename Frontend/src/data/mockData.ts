import axios from 'axios';

const baseUrl = import.meta.env.VITE_BACKEND_URL || 'http://localhost:8000';
const Backend_URL = import.meta.env.VITE_DASHBOARD_URL || `${baseUrl.replace(/\/$/, '')}/dashboard/`;

export interface DashboardData {
  monthWiseData: any[];
  outputTypeData: any[];
  inputTypeData: any[];
  channelData: any[];
  userData: any[];
  kpiData: {
    totalUploaded: number | string;
    totalCreated: number | string;
    totalPublished: number | string;
    totalUploadedDuration?: string;
    totalCreatedDuration?: string;
    totalPublishedDuration?: string;
  };
  languageData: any[];
  blueprint?: {
    languageData: any[];
    funnelData: any[];
    outputData: any[];
    inputData: any[];
    platformData: any[];
  };
}

export const fetchDashboardData = async (): Promise<DashboardData> => {
  const response = await axios.get(Backend_URL);
  return response.data;
};
