/**
 * Consumer of UserService
 */

import { UserService, User, createDefaultUser } from './sample';

export class UserManager {
  private service: UserService;

  constructor() {
    this.service = new UserService();
  }

  initialize(): void {
    const defaultUser = createDefaultUser();
    this.service.addUser(defaultUser);

    const adminUser: User = {
      id: 1,
      name: 'Admin',
      email: 'admin@example.com'
    };
    this.service.addUser(adminUser);
  }

  getUser(id: number): User | undefined {
    return this.service.findUserById(id);
  }

  listAll(): User[] {
    return this.service.getAllUsers();
  }
}

// Create manager and use it
const manager = new UserManager();
manager.initialize();

const user = manager.getUser(1);
if (user) {
  console.log(`Found user: ${user.name}`);
}

