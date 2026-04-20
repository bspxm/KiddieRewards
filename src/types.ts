/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

export type UserRole = 'parent' | 'child' | 'admin';

export interface UserProfile {
  id: string;
  name: string;
  role: UserRole;
  familyId?: string;
  parentId?: string; // For children, link to their parent
  points: number;
  avatar?: string;
}

export interface RewardRule {
  id: string;
  parentId: string;
  title: string;
  description: string;
  points: number; // Positive for earning, Negative for "cost" (if used as penalty)
  icon?: string;
  isRepeating: boolean; // true for repeating, false for one-time
}

export interface RewardItem {
  id: string;
  parentId: string;
  title: string;
  description: string;
  pointsRequired: number;
  stock?: number;
  image?: string;
}

export interface RedemptionRecord {
  id: string;
  childId: string;
  parentId: string;
  rewardId: string;
  status: 'pending' | 'approved' | 'rejected';
  timestamp: number;
  rewardTitle: string;
  pointsAtTime: number;
}

export interface TaskSubmission {
  id: string;
  childId: string;
  parentId: string;
  ruleId: string;
  title: string;
  points: number;
  status: 'pending' | 'approved' | 'rejected';
  rejectionReason?: string;
  timestamp: number;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'success' | 'error' | 'info';
  isRead: number;
  timestamp: number;
}

export interface PointHistory {
  id: string;
  childId: string;
  amount: number;
  reason: string;
  timestamp: number;
  type: 'earn' | 'spend';
}
