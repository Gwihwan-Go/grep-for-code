"""Consumer of UserService"""

from typing import List, Optional
from sample import User, UserService, create_default_user


class UserManager:
    """Manages a UserService instance"""
    
    def __init__(self):
        self.service = UserService()
    
    def initialize(self) -> None:
        """Initialize the manager with default data"""
        default_user = create_default_user()
        self.service.add_user(default_user)
        
        admin_user = User(
            id=1,
            name="Admin",
            email="admin@example.com"
        )
        self.service.add_user(admin_user)
    
    def get_user(self, user_id: int) -> Optional[User]:
        """Get a user by ID"""
        return self.service.find_user_by_id(user_id)
    
    def list_all(self) -> List[User]:
        """List all users"""
        return self.service.get_all_users()


def main():
    """Main entry point"""
    manager = UserManager()
    manager.initialize()
    
    user = manager.get_user(1)
    if user:
        print(f"Found user: {user.name}")


if __name__ == "__main__":
    main()

