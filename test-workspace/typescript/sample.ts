/**
 * Sample TypeScript code for testing LSP functionality
 */

export interface User {
  id: number;
  name: string;
  email: string;
}

export class UserService {
  private users: User[] = [];

  constructor() {
    this.users = [];
  }

  addUser(user: User): void {
    this.users.push(user);
  }

  findUserById(id: number): User | undefined {
    return this.users.find(u => u.id === id);
  }

  getAllUsers(): User[] {
    return [...this.users];
  }

  getUserCount(): number {
    return this.users.length;
  }
}

export function createDefaultUser(): User {
  return {
    id: 0,
    name: 'Guest',
    email: 'guest@example.com'
  };
}

// Usage example
const service = new UserService();
const defaultUser = createDefaultUser();
service.addUser(defaultUser);

console.log(`Total users: ${service.getUserCount()}`);

