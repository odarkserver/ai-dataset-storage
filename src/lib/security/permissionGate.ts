export interface Permission {
  action: string;
  user: string;
  granted: boolean;
  timestamp: Date;
  reason?: string;
}

export interface Role {
  name: string;
  permissions: string[];
  description: string;
}

export class PermissionGate {
  private static instance: PermissionGate;
  private permissions: Map<string, Set<string>> = new Map();
  private roles: Map<string, Role> = new Map();
  private auditLog: Permission[] = [];

  private constructor() {
    this.initializeRoles();
    this.initializePermissions();
  }

  static getInstance(): PermissionGate {
    if (!PermissionGate.instance) {
      PermissionGate.instance = new PermissionGate();
    }
    return PermissionGate.instance;
  }

  /**
   * Initialize system roles
   */
  private initializeRoles(): void {
    // Super Admin Role - Han only
    this.roles.set('super_admin', {
      name: 'Super Admin',
      permissions: [
        'pluginSummarizer',
        'pluginTranslator',
        'pluginGitHubStorage',
        'restartAgent',
        'clearCache',
        'getPersona',
        'updateMemory',
        'systemDiagnostic',
        'healthCheck',
        'systemConfiguration',
        'userManagement',
        'auditAccess',
        'apiManagement'
      ],
      description: 'Full system access - Only Han'
    });

    // Admin Role
    this.roles.set('admin', {
      name: 'Administrator',
      permissions: [
        'pluginSummarizer',
        'pluginTranslator',
        'pluginGitHubStorage',
        'getPersona',
        'systemDiagnostic',
        'healthCheck'
      ],
      description: 'Administrative access - Limited permissions'
    });

    // User Role
    this.roles.set('user', {
      name: 'User',
      permissions: [
        'pluginSummarizer',
        'pluginTranslator',
        'pluginGitHubStorage',
        'getPersona'
      ],
      description: 'Basic user access - Read-only plugins'
    });

    // Guest Role
    this.roles.set('guest', {
      name: 'Guest',
      permissions: [],
      description: 'No execution permissions - Chat only'
    });
  }

  /**
   * Initialize user permissions
   */
  private initializePermissions(): void {
    // Han - Super Admin (all permissions) - support both cases
    this.permissions.set('Han', new Set(this.roles.get('super_admin')!.permissions));
    this.permissions.set('han', new Set(this.roles.get('super_admin')!.permissions));
    
    // Add other users as needed
    // this.permissions.set('AdminUser', new Set(this.roles.get('admin')!.permissions));
    // this.permissions.set('RegularUser', new Set(this.roles.get('user')!.permissions));
  }

  /**
   * Check if user is authorized for specific action
   */
  isAuthorized(action: string, user: string): boolean {
    const userPermissions = this.permissions.get(user);
    
    if (!userPermissions) {
      // User not found, deny access
      this.logPermission(action, user, false, 'User not found in permission system');
      return false;
    }

    const isAuthorized = userPermissions.has(action);
    
    this.logPermission(action, user, isAuthorized, isAuthorized ? 'Action authorized' : 'Action not in user permissions');
    
    return isAuthorized;
  }

  /**
   * Check if user has specific role
   */
  hasRole(user: string, role: string): boolean {
    const userPermissions = this.permissions.get(user);
    const rolePermissions = this.roles.get(role);
    
    if (!userPermissions || !rolePermissions) {
      return false;
    }

    // Check if user has all permissions of the role
    for (const permission of rolePermissions.permissions) {
      if (!userPermissions.has(permission)) {
        return false;
      }
    }
    
    return true;
  }

  /**
   * Grant permission to user
   */
  grantPermission(user: string, action: string, grantedBy: string): boolean {
    // Only super admin can grant permissions
    if (!this.hasRole(grantedBy, 'super_admin')) {
      console.warn(`❌ ${grantedBy} attempted to grant permission without super admin role`);
      return false;
    }

    if (!this.permissions.has(user)) {
      this.permissions.set(user, new Set());
    }

    const userPermissions = this.permissions.get(user)!;
    userPermissions.add(action);
    
    console.log(`✅ Permission '${action}' granted to ${user} by ${grantedBy}`);
    return true;
  }

  /**
   * Revoke permission from user
   */
  revokePermission(user: string, action: string, revokedBy: string): boolean {
    // Only super admin can revoke permissions
    if (!this.hasRole(revokedBy, 'super_admin')) {
      console.warn(`❌ ${revokedBy} attempted to revoke permission without super admin role`);
      return false;
    }

    const userPermissions = this.permissions.get(user);
    if (!userPermissions) {
      return false;
    }

    const removed = userPermissions.delete(action);
    
    if (removed) {
      console.log(`✅ Permission '${action}' revoked from ${user} by ${revokedBy}`);
    }
    
    return removed;
  }

  /**
   * Assign role to user
   */
  assignRole(user: string, role: string, assignedBy: string): boolean {
    // Only super admin can assign roles
    if (!this.hasRole(assignedBy, 'super_admin')) {
      console.warn(`❌ ${assignedBy} attempted to assign role without super admin role`);
      return false;
    }

    const roleData = this.roles.get(role);
    if (!roleData) {
      console.warn(`❌ Role '${role}' not found`);
      return false;
    }

    this.permissions.set(user, new Set(roleData.permissions));
    console.log(`✅ Role '${role}' assigned to ${user} by ${assignedBy}`);
    return true;
  }

  /**
   * Get user permissions
   */
  getUserPermissions(user: string): string[] {
    const userPermissions = this.permissions.get(user);
    return userPermissions ? Array.from(userPermissions) : [];
  }

  /**
   * Get all available roles
   */
  getAvailableRoles(): Role[] {
    return Array.from(this.roles.values());
  }

  /**
   * Get user role
   */
  getUserRole(user: string): string | null {
    const userPermissions = this.permissions.get(user);
    if (!userPermissions) {
      return null;
    }

    // Check each role to find match
    for (const [roleName, roleData] of this.roles.entries()) {
      let hasAllPermissions = true;
      
      for (const permission of roleData.permissions) {
        if (!userPermissions.has(permission)) {
          hasAllPermissions = false;
          break;
        }
      }
      
      if (hasAllPermissions) {
        return roleName;
      }
    }
    
    return null;
  }

  /**
   * Get permission audit log
   */
  getPermissionAudit(limit: number = 50): Permission[] {
    return this.auditLog.slice(-limit);
  }

  /**
   * Check if action requires approval
   */
  requiresApproval(action: string): boolean {
    const highImpactActions = [
      'restartAgent',
      'clearCache',
      'updateMemory',
      'systemConfiguration',
      'userManagement',
      'apiManagement'
    ];
    
    return highImpactActions.includes(action);
  }

  /**
   * Get action risk level
   */
  getActionRiskLevel(action: string): 'low' | 'medium' | 'high' | 'critical' {
    const criticalActions = ['restartAgent'];
    const highActions = ['clearCache', 'updateMemory', 'userManagement'];
    const mediumActions = ['systemDiagnostic', 'systemConfiguration'];
    
    if (criticalActions.includes(action)) return 'critical';
    if (highActions.includes(action)) return 'high';
    if (mediumActions.includes(action)) return 'medium';
    return 'low';
  }

  /**
   * Log permission check
   */
  private logPermission(action: string, user: string, granted: boolean, reason?: string): void {
    const permission: Permission = {
      action,
      user,
      granted,
      timestamp: new Date(),
      reason
    };
    
    this.auditLog.push(permission);
    
    // Keep audit log size manageable
    if (this.auditLog.length > 1000) {
      this.auditLog = this.auditLog.slice(-500);
    }
    
    // Log to console for debugging
    const status = granted ? '✅' : '❌';
    const riskLevel = this.getActionRiskLevel(action);
    console.log(`${status} Permission Check: ${user} -> ${action} (${riskLevel}) ${reason ? `- ${reason}` : ''}`);
  }

  /**
   * Get system statistics
   */
  getSystemStats(): {
    totalUsers: number;
    totalRoles: number;
    totalPermissions: number;
    recentChecks: number;
    userBreakdown: Record<string, string>;
  } {
    const userBreakdown: Record<string, string> = {};
    
    for (const [user, permissions] of this.permissions.entries()) {
      const role = this.getUserRole(user);
      userBreakdown[user] = role || 'custom';
    }
    
    return {
      totalUsers: this.permissions.size,
      totalRoles: this.roles.size,
      totalPermissions: Array.from(this.permissions.values()).reduce((sum, perms) => sum + perms.size, 0),
      recentChecks: this.auditLog.length,
      userBreakdown
    };
  }

  /**
   * Export permissions for backup
   */
  exportPermissions(): {
    users: Record<string, string[]>;
    roles: Record<string, Role>;
    timestamp: string;
  } {
    const users: Record<string, string[]> = {};
    
    for (const [user, permissions] of this.permissions.entries()) {
      users[user] = Array.from(permissions);
    }
    
    const roles: Record<string, Role> = {};
    for (const [name, role] of this.roles.entries()) {
      roles[name] = role;
    }
    
    return {
      users,
      roles,
      timestamp: new Date().toISOString()
    };
  }

  /**
   * Import permissions from backup
   */
  importPermissions(data: any, importedBy: string): boolean {
    // Only super admin can import permissions
    if (!this.hasRole(importedBy, 'super_admin')) {
      console.warn(`❌ ${importedBy} attempted to import permissions without super admin role`);
      return false;
    }

    try {
      // Import users
      if (data.users) {
        for (const [user, permissions] of Object.entries(data.users)) {
          this.permissions.set(user, new Set(permissions as string[]));
        }
      }
      
      console.log(`✅ Permissions imported by ${importedBy}`);
      return true;
    } catch (error) {
      console.error('❌ Failed to import permissions:', error);
      return false;
    }
  }
}