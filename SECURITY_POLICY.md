# Security Policy

**Offline Warehouse Dispatch Management Software**

**Provider:** Stivate  
**Software:** Warehouse Dispatch Management Software  

---

## 1. Purpose

This Security Policy describes the security principles and controls applicable to the Software and its supporting services.

The primary objective is to protect customer operational information while maintaining reliable warehouse operations.

---

## 2. Security Architecture

The application follows an offline-first model.

```
Warehouse PC
     │
     ├── Local Application
     │
     ├── Local Database
     │
     ├── Local Backups
     │
     └── Internet when available
              │
              ├── Cloud Backup
              │
              └── Software Updates
```

Normal warehouse operations should not depend on internet connectivity.

---

## 3. Local Database Security

The local database should:
- Be stored outside the application's installation directory.
- Be accessible only through the application where practical.
- Not be exposed through a public network interface.
- Be protected by Windows filesystem permissions.
- Be included in the application's backup process.

The application should not expose the database through an unauthenticated network service.

---

## 4. Backup Security

Local backups should:
- Be stored separately from the active database.
- Use controlled filesystem permissions.
- Maintain a defined retention period.
- Be protected against accidental deletion where practical.

Cloud backups should:
- Use private storage.
- Disable public access.
- Use restricted credentials or roles.
- Use encryption in transit.
- Use encryption at rest where supported.
- Maintain appropriate retention controls.

---

## 5. Cloud Credentials

Cloud credentials must never be hard-coded into the application source code or committed to GitHub.

Use secure environment/credential management rather than hard-coded access keys in source code.

A GitHub repository should never contain:
- `AWS_ACCESS_KEY_ID`
- `AWS_SECRET_ACCESS_KEY`

or similar secrets.

---

## 6. Access Control

Access to customer systems and cloud infrastructure should follow the principle of least privilege.

Only authorized personnel should have access to:
- Production cloud resources
- Backup storage
- Customer support information
- Deployment credentials
- Source code repositories

---

## 7. Software Updates

Software updates should be distributed through authenticated/trusted release infrastructure.

Updates should be versioned (e.g. `1.0.0`, `1.0.1`, `1.1.0`, `2.0.0`).

Users should be able to verify the installed application version.

---

## 8. Database Integrity

The application should protect against data corruption by:
- Using transactional database operations.
- Handling unexpected application shutdowns.
- Performing safe writes.
- Creating backups.
- Providing database restoration procedures.

---

## 9. Backup Recovery

The backup system should support recovery following:
- Hardware failure
- Database corruption
- Accidental deletion
- Software failure

Restoration procedures should be tested periodically.

---

## 10. Logging

Where appropriate, the application may maintain logs for:
- Application errors
- Backup failures
- Cloud backup status
- Database errors
- Update status
- Security-relevant events

Logs should not unnecessarily contain sensitive information.

---

## 11. Secure Development

Development practices should include:
- Dependency updates
- Vulnerability scanning
- Code review where applicable
- Secure secret management
- Input validation
- Error handling
- Database transaction safety
- Secure release procedures

---

## 12. Incident Response

If a security incident occurs:

1. **Step 1:** Identify and confirm the incident.
2. **Step 2:** Contain the affected system.
3. **Step 3:** Protect or preserve relevant logs.
4. **Step 4:** Investigate the cause.
5. **Step 5:** Recover affected services.
6. **Step 6:** Apply corrective measures.
7. **Step 7:** Notify affected parties where required.

---

## 13. Employee & Developer Access

Personnel with access to production infrastructure should use:
- Individual accounts
- Strong authentication
- Least-privilege permissions
- Secure credential storage

Shared production credentials should be avoided.

---

## 14. Third-Party Services

The Software may use third-party services for:
- Cloud backup
- Software distribution
- Update delivery
- Support requests

Third-party access should be limited to the information necessary for the relevant service.

---

## 15. Security Responsibilities

### Stivate
Responsible for:
- Application security
- Secure development
- Release management
- Cloud infrastructure configuration under Stivate's control
- Security incident response within its scope

### Customer
Responsible for:
- Physical PC security
- Windows account security
- Authorized operator access
- Protecting local credentials
- Preventing unauthorized use of the computer
- Maintaining appropriate internal security procedures

---

## 16. Security Limitations

No software system can guarantee absolute security.

Security depends on the application, operating system, hardware, network, cloud infrastructure, credentials, and user practices.

The Software is designed to reduce security and data-loss risks but cannot eliminate every possible risk.
