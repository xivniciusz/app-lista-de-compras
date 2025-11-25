"""criar tabela usuarios

Revision ID: 7f9d4c6a23a5
Revises: 8f3ab58df7e1
Create Date: 2025-11-25 14:30:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '7f9d4c6a23a5'
down_revision: Union[str, Sequence[str], None] = '8f3ab58df7e1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'usuarios',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('nome', sa.String(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('senha_hash', sa.Text(), nullable=False),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index('ix_usuarios_email', 'usuarios', ['email'], unique=True)
    op.create_index('ix_usuarios_id', 'usuarios', ['id'], unique=False)


def downgrade() -> None:
    op.drop_index('ix_usuarios_id', table_name='usuarios')
    op.drop_index('ix_usuarios_email', table_name='usuarios')
    op.drop_table('usuarios')
