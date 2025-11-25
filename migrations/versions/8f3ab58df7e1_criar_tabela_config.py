"""criar tabela config

Revision ID: 8f3ab58df7e1
Revises: 3245d65ddab1
Create Date: 2025-11-25 04:40:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '8f3ab58df7e1'
down_revision: Union[str, Sequence[str], None] = '3245d65ddab1'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Cria tabela de configuração."""
    op.create_table(
        'config',
        sa.Column('id', sa.Integer(), primary_key=True),
        sa.Column('tema', sa.String(), nullable=False, server_default='claro'),
        sa.Column('criado_em', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column(
            'atualizado_em',
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )


def downgrade() -> None:
    """Remove tabela de configuração."""
    op.drop_table('config')
