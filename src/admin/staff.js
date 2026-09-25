import { pool } from '../auth/db.js';
import { hashPassword } from '../auth/security.js';

const tables = {customers:'app_users',trackings:'app_client_tracking',contracts:'app_contracts',invoices:'app_invoices'};
export const ownerScope = actor => actor.role === 'employee' ? actor.id : null;
export const assertOwned = async (actor, kind, id) => {
  if (!id || !/^[0-9a-f-]{36}$/i.test(String(id))) throw Object.assign(new Error('Registro não encontrado.'),{status:404});
  const table=tables[kind];
  if(!table) throw new Error('Tipo de registro inválido');
  const {rows}=await pool.query(`select id, owner_id ${kind==='customers'?', role':''} from public.${table} where id=$1`,[id]);
  const record=rows[0];
  if(!record || (kind==='customers' && record.role!=='customer') || (ownerScope(actor)&&record.owner_id!==actor.id)) throw Object.assign(new Error('Registro não encontrado ou sem permissão.'),{status:404});
  return record;
};
export const listStaff = async () => (await pool.query("select id,full_name,email,is_active,created_at from public.app_users where role='employee' order by created_at desc")).rows;
export const saveStaff = async ({id,fullName,email,password,isActive}) => {
  if(id){
    if(!/^[0-9a-f-]{36}$/i.test(String(id))) throw Object.assign(new Error('Usuário inválido.'),{status:400});
    if(typeof isActive!=='boolean' && !password) throw Object.assign(new Error('Informe a situação ou uma nova senha.'),{status:400});
    if(password && (typeof password!=='string'||password.length<8)) throw Object.assign(new Error('Use uma senha com pelo menos 8 caracteres.'),{status:400});
    const hash=password?await hashPassword(password):null;
    const {rows}=await pool.query("update public.app_users set is_active=coalesce($2,is_active),password_hash=coalesce($3,password_hash) where id=$1 and role='employee' returning id,full_name,email,is_active",[id,typeof isActive==='boolean'?isActive:null,hash]);
    if(!rows[0])throw Object.assign(new Error('Funcionário não encontrado.'),{status:404});
    return rows[0];
  }
  if(typeof fullName!=='string'||!fullName.trim()||typeof email!=='string'||!/^\S+@\S+\.\S+$/.test(email.trim())||typeof password!=='string'||password.length<8)throw Object.assign(new Error('Informe nome, e-mail válido e senha com pelo menos 8 caracteres.'),{status:400});
  const {rows}=await pool.query(`insert into public.app_users(full_name,email,whatsapp,cpf,cep,address,number,district,password_hash,role)
    values($1,$2,'','employee-'||gen_random_uuid()::text,'','','','',$3,'employee') returning id,full_name,email,is_active`,[fullName.trim(),email.trim().toLowerCase(),await hashPassword(password)]);
  return rows[0];
};
