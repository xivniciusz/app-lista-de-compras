# models.py - definição dos modelos SQLAlchemy (comentários em português)
from sqlalchemy.orm import declarative_base, relationship
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from sqlalchemy.sql import func

Base = declarative_base()

class Lista(Base):
    __tablename__ = 'listas'
    id = Column(Integer, primary_key=True, index=True)
    nome = Column(String, nullable=False)
    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    finalizada = Column(Boolean, nullable=False, server_default='false')
    finalizada_em = Column(DateTime(timezone=True), nullable=True)

class Item(Base):
    __tablename__ = 'itens'
    id = Column(Integer, primary_key=True, index=True)
    lista_id = Column(Integer, ForeignKey('listas.id', ondelete='CASCADE'), nullable=False, index=True)
    nome = Column(String, nullable=False)
    quantidade = Column(Integer, nullable=False, server_default='1')
    comprado = Column(Boolean, nullable=False, server_default='false')
    ordem = Column(Integer, nullable=False, server_default='0')
    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)

# Relacionamento na Lista
Lista.itens = relationship('Item', backref='lista', cascade='all, delete-orphan', passive_deletes=True)


class Configuracao(Base):
    __tablename__ = 'config'
    id = Column(Integer, primary_key=True, index=True)
    tema = Column(String, nullable=False, server_default='claro')
    criado_em = Column(DateTime(timezone=True), server_default=func.now(), nullable=False)
    atualizado_em = Column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now(), nullable=False)
