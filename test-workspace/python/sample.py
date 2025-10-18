"""Sample Python code for testing LSP functionality"""

from typing import List, Optional
from dataclasses import dataclass


@dataclass
class User:
    """Represents a user in the system"""
    id: int
    name: str
    email: str


class UserService:
    """Manages users in the system"""
    
    def __init__(self):
        self.users: List[User] = []
    
    def add_user(self, user: User) -> None:
        """Add a user to the service"""
        self.users.append(user)
    
    def find_user_by_id(self, user_id: int) -> Optional[User]:
        """Find a user by ID"""
        for user in self.users:
            if user.id == user_id:
                return user
        return None
    
    def get_all_users(self) -> List[User]:
        """Get all users"""
        return self.users.copy()
    
    def get_user_count(self) -> int:
        """Get the total number of users"""
        return len(self.users)


def create_default_user() -> User:
    """Create a default guest user"""
    return User(
        id=0,
        name="Guest",
        email="guest@example.com"
    )


def main():
    """Main entry point"""
    service = UserService()
    default_user = create_default_user()
    service.add_user(default_user)
    
    print(f"Total users: {service.get_user_count()}")


if __name__ == "__main__":
    main()

