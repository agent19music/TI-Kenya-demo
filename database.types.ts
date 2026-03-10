export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      complaints: {
        Row: {
          id: string;
          raw_complaint: string;
          complaint_hash: string;
          ai_category: string;
          ai_priority: string;
          ai_confidence: number;
          ai_summary: string | null;
          triage_status: string;
          triage_error: string | null;
          sender_country: string | null;
          sender_city: string | null;
          report_county: string | null;
          reporter_age_group: string | null;
          reporter_sex: string | null;
          has_disability: string | null;
          is_anonymous: boolean;
          reporter_phone: string | null;
          attachment_url: string | null;
          attachment_mime: string | null;
          attachment_name: string | null;
          attachment_size_bytes: number | null;
          duplicate_count: number;
          last_received_at: string;
          recommended_agency: string | null;
          requires_ipoa_form: boolean;
          dispatch_status: string;
          dispatched_at: string | null;
          dispatch_error: string | null;
          status: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          raw_complaint: string;
          complaint_hash: string;
          ai_category: string;
          ai_priority: string;
          ai_confidence: number;
          ai_summary?: string | null;
          triage_status?: string;
          triage_error?: string | null;
          sender_country?: string | null;
          sender_city?: string | null;
          report_county?: string | null;
          reporter_age_group?: string | null;
          reporter_sex?: string | null;
          has_disability?: string | null;
          is_anonymous?: boolean;
          reporter_phone?: string | null;
          attachment_url?: string | null;
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_size_bytes?: number | null;
          duplicate_count?: number;
          last_received_at?: string;
          recommended_agency?: string | null;
          requires_ipoa_form?: boolean;
          dispatch_status?: string;
          dispatched_at?: string | null;
          dispatch_error?: string | null;
          status?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          raw_complaint?: string;
          complaint_hash?: string;
          ai_category?: string;
          ai_priority?: string;
          ai_confidence?: number;
          ai_summary?: string | null;
          triage_status?: string;
          triage_error?: string | null;
          sender_country?: string | null;
          sender_city?: string | null;
          report_county?: string | null;
          reporter_age_group?: string | null;
          reporter_sex?: string | null;
          has_disability?: string | null;
          is_anonymous?: boolean;
          reporter_phone?: string | null;
          attachment_url?: string | null;
          attachment_mime?: string | null;
          attachment_name?: string | null;
          attachment_size_bytes?: number | null;
          duplicate_count?: number;
          last_received_at?: string;
          recommended_agency?: string | null;
          requires_ipoa_form?: boolean;
          dispatch_status?: string;
          dispatched_at?: string | null;
          dispatch_error?: string | null;
          status?: string;
          created_at?: string;
        };
        Relationships: [];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};
