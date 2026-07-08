import { Component, OnInit } from '@angular/core';
import { AuditLog, AuditLogService } from 'src/app/services/audit-log.service';

@Component({
  selector: 'app-dashboard-superadmin',
  templateUrl: './dashboard-superadmin.component.html',
  styleUrls: ['./dashboard-superadmin.component.scss']
})
export class DashboardSuperadminComponent implements OnInit {

  logs: AuditLog[] = [];
  filteredLogs: AuditLog[] = [];
  searchEmail = '';
  searchAction = '';

  constructor(private readonly auditService: AuditLogService) {}

  ngOnInit(): void {
    this.auditService.getTousLesLogs().subscribe(data => {
      this.logs = data;
      this.filteredLogs = data;
    });
  }

  filtrer(): void {
    this.filteredLogs = this.logs.filter(log => {
      const matchEmail = !this.searchEmail ||
        log.utilisateurEmail.toLowerCase().includes(this.searchEmail.toLowerCase());
      const matchAction = !this.searchAction ||
        log.action === this.searchAction;
      return matchEmail && matchAction;
    });
  }

  getBadgeClass(action: string): string {
    const map: Record<string, string> = {
      CREATE:   'badge bg-success',
      UPDATE:   'badge bg-warning text-dark',
      DELETE:   'badge bg-danger',
      ACTIVER:  'badge bg-primary',
      CLOTURER: 'badge bg-secondary'
    };
    return map[action] ?? 'badge bg-light text-dark';
  }
}