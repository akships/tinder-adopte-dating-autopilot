// Generated by https://quicktype.io

export interface TinderMatch {
  meta: Meta;
  data: Data;
}

export interface Data {
  matches?: Match[];
}

export interface Match {
  seen?: Seen;
  _id?: string;
  id?: string;
  closed?: boolean;
  common_friend_count?: number;
  common_like_count?: number;
  created_date?: string;
  dead?: boolean;
  last_activity_date?: string;
  message_count?: number;
  messages?: Message[];
  participants?: string[];
  pending?: boolean;
  is_super_like?: boolean;
  is_boost_match?: boolean;
  is_super_boost_match?: boolean;
  is_primetime_boost_match?: boolean;
  is_experiences_match?: boolean;
  is_fast_match?: boolean;
  is_preferences_match?: boolean;
  is_matchmaker_match?: boolean;
  is_lets_meet_match?: boolean;
  is_opener?: boolean;
  has_shown_initial_interest?: boolean;
  person?: Person;
  following?: boolean;
  following_moments?: boolean;
  readreceipt?: Readreceipt;
}

export interface Message {
  _id?: string;
  match_id?: string;
  sent_date?: string;
  message?: string;
  to?: string;
  from?: string;
  timestamp?: number;
  matchId?: string;
  created_date?: string;
}

export interface Person {
  _id: string;
  bio?: string;
  birth_date?: string;
  gender?: number;
  name?: string;
  ping_time?: string;
  photos?: Photo[];
}

export interface Photo {
  id?: string;
  crop_info?: CropInfo;
  url?: string;
  processedFiles?: ProcessedFile[];
  fileName?: string;
  extension?: Extension;
  webp_qf?: number[];
  rank?: number;
  score?: number;
  win_count?: number;
  type?: Type;
  assets?: any[];
  media_type?: Type;
}

export interface CropInfo {
  user?: Algo;
  algo?: Algo;
  processed_by_bullseye?: boolean;
  user_customized?: boolean;
  faces?: Face[];
}

export interface Algo {
  width_pct?: number;
  x_offset_pct?: number;
  height_pct?: number;
  y_offset_pct?: number;
}

export interface Face {
  algo?: Algo;
  bounding_box_percentage?: number;
}

export enum Extension {
  JpgWebp = 'jpg,webp',
}

export enum Type {
  Image = 'image',
}

export interface ProcessedFile {
  url?: string;
  height?: number;
  width?: number;
}

export interface Readreceipt {
  enabled?: boolean;
}

export interface Seen {
  match_seen?: boolean;
  last_seen_msg_id?: string;
}

export interface Meta {
  status?: number;
}
