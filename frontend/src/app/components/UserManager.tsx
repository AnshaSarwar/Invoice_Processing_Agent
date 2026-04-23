"use client";

import { useState, useEffect, useCallback } from 'react';
import { api, User, UserUpdate } from '../api';

interface UserManagerProps {
  currentUser: User;
}

export default function UserManager({ currentUser }: UserManagerProps) {
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [editForm, setEditForm] = useState<UserUpdate>({});
  const [actionMsg, setActionMsg] = useState('');
  const [searchQuery, setSearchQuery] = useState('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [activeRoleFilter, setActiveRoleFilter] = useState<'All' | 'Admin' | 'Operator'>('All');
  const [addForm, setAddForm] = useState({ username: '', password: '', email: '', role: 'Operator' });
  const [deleteConfirmId, setDeleteConfirmId] = useState<number | null>(null);

  const fetchUsers = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.getUsers(currentUser);
      setUsers(res.users || []);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
    } finally {
      setLoading(false);
    }
  }, [currentUser]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleEdit = (user: User) => {
    setEditingId(user.id);
    setEditForm({ role: user.role, email: user.email || '' });
  };

  const handleSave = async (userId: number) => {
    try {
      await api.updateUser(userId, editForm, currentUser);
      setEditingId(null);
      setEditForm({});
      setActionMsg('✅ User updated successfully');
      fetchUsers();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteConfirmId) return;
    try {
      await api.deleteUser(deleteConfirmId, currentUser);
      setActionMsg(`✅ User deleted successfully`);
      setDeleteConfirmId(null);
      fetchUsers();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
      setDeleteConfirmId(null);
      setTimeout(() => setActionMsg(''), 4000);
    }
  };

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!addForm.username || !addForm.password) {
      setActionMsg('❌ Username and password are required');
      return;
    }
    try {
      setLoading(true);
      await api.createUser(addForm, currentUser);
      setActionMsg('✅ User created successfully');
      setShowAddModal(false);
      setAddForm({ username: '', password: '', email: '', role: 'Operator' });
      fetchUsers();
      setTimeout(() => setActionMsg(''), 3000);
    } catch (e: any) {
      setActionMsg(`❌ ${e.message}`);
      setTimeout(() => setActionMsg(''), 4000);
    } finally {
      setLoading(false);
    }
  };

  const stats = {
    total: users.length,
    admins: users.filter(u => u.role === 'Admin').length,
    operators: users.filter(u => u.role === 'Operator').length,
  };

  const filteredUsers = users.filter(u => {
    const matchesSearch = u.username.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          (u.email || '').toLowerCase().includes(searchQuery.toLowerCase());
    const matchesRole = activeRoleFilter === 'All' || u.role === activeRoleFilter;
    return matchesSearch && matchesRole;
  });

  const roleBadge = (role: string) => {
    const styles: Record<string, { bg: string; text: string; dot: string }> = {
      Admin: { bg: 'bg-red-500/10', text: 'text-red-400', dot: 'bg-red-500' },
      Operator: { bg: 'bg-blue-500/10', text: 'text-blue-400', dot: 'bg-blue-500' },
    };
    const s = styles[role] || styles.Operator;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider ${s.bg} ${s.text}`}>
        <span className={`w-1.5 h-1.5 rounded-full ${s.dot}`} />
        {role}
      </span>
    );
  };

  return (
    <div className="space-y-6 animate-in fade-in duration-500">
      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
        {[
          { label: 'Total Users', value: stats.total, color: 'text-zinc-950', icon: '👥' },
          { label: 'Admins', value: stats.admins, color: 'text-red-600', icon: '🛡️' },
          { label: 'Operators', value: stats.operators, color: 'text-blue-600', icon: '⚙️' },
        ].map((s, idx) => (
          <div key={idx} className="bg-white p-4 rounded-2xl border border-zinc-200 flex items-center gap-4 shadow-sm">
            <div className="text-2xl">{s.icon}</div>
            <div>
              <p className="text-[10px] uppercase font-bold text-zinc-500 tracking-widest">{s.label}</p>
              <p className={`text-xl font-black ${s.color}`}>{s.value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* controls */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4">
        <div className="flex bg-zinc-100 p-1 rounded-xl border border-zinc-200">
          {['All', 'Admin', 'Operator'].map((role) => (
            <button
              key={role}
              onClick={() => setActiveRoleFilter(role as any)}
              className={`px-4 py-1.5 rounded-lg text-xs font-bold transition-all ${
                activeRoleFilter === role 
                ? 'bg-white text-zinc-900 shadow-sm' 
                : 'text-zinc-500 hover:text-zinc-800'
              }`}
            >
              {role}
            </button>
          ))}
        </div>

        <div className="flex gap-3 w-full lg:w-auto">
          <div className="relative flex-1 lg:w-64">
            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500">🔍</span>
            <input
              type="text"
              placeholder="Search by name or email..."
              className="bg-zinc-50 border border-zinc-200 rounded-xl pl-9 pr-4 py-2 text-sm text-zinc-900 placeholder:text-zinc-400 focus:border-blue-500 outline-none transition-all w-full"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>
          <button
            onClick={() => setShowAddModal(true)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-6 py-2 rounded-xl text-sm font-bold transition-all shadow-lg shadow-blue-500/20 whitespace-nowrap active:scale-95"
          >
            + New User
          </button>
        </div>
      </div>

      {/* Status Message */}
      {actionMsg && (
        <div className={`text-xs font-medium px-4 py-3 rounded-xl animate-in slide-in-from-top-2 duration-300 ${
          actionMsg.startsWith('✅') ? 'bg-green-500/10 border border-green-500/20 text-green-400' : 'bg-red-500/10 border border-red-500/20 text-red-400'
        }`}>
          {actionMsg}
        </div>
      )}

      {/* Users Table */}
      <div className="glass rounded-2xl overflow-hidden border border-white/5">
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-zinc-50 text-zinc-500 text-[10px] uppercase font-bold tracking-widest border-b border-zinc-200">
                <th className="px-6 py-4">User</th>
                <th className="px-6 py-4">Role</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4">Joined</th>
                <th className="px-6 py-4 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {loading ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="inline-block w-6 h-6 border-2 border-blue-500 border-t-transparent rounded-full animate-spin mb-4" />
                    <p className="text-zinc-500 text-sm">Synchronizing user data...</p>
                  </td>
                </tr>
              ) : filteredUsers.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-6 py-20 text-center">
                    <div className="text-4xl mb-4">🌑</div>
                    <p className="text-zinc-600 text-sm mt-2 font-medium">No members found matching your criteria.</p>
                  </td>
                </tr>
              ) : filteredUsers.map((u) => (
                <tr key={u.id} className="group hover:bg-white/[0.02] transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-zinc-100 border border-zinc-200 flex items-center justify-center text-sm font-bold text-zinc-950 uppercase">
                        {u.username[0]}
                      </div>
                      <div>
                        <div className="text-sm font-bold text-zinc-950 flex items-center gap-2">
                          {u.username}
                          {u.id === currentUser.id && (
                            <span className="text-[9px] px-1.5 py-0.5 bg-zinc-100 text-zinc-500 rounded-md font-black uppercase tracking-tighter">You</span>
                          )}
                        </div>
                        <div className="text-[11px] text-zinc-500 font-medium">
                          {editingId === u.id ? (
                            <input
                              type="email"
                              className="bg-white/10 border border-white/10 rounded px-2 py-0.5 mt-1 text-white outline-none w-48 focus:border-blue-500"
                              value={editForm.email || ''}
                              onChange={(e) => setEditForm({ ...editForm, email: e.target.value })}
                            />
                          ) : (
                            u.email || 'No email associated'
                          )}
                        </div>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    {editingId === u.id ? (
                      <select
                        className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:border-blue-500 outline-none transition-all"
                        value={editForm.role || u.role}
                        onChange={(e) => setEditForm({ ...editForm, role: e.target.value as any })}
                      >
                        <option value="Operator">Operator</option>
                        <option value="Admin">Admin</option>
                      </select>
                    ) : (
                      roleBadge(u.role)
                    )}
                  </td>
                  <td className="px-6 py-4">
                    <span className="inline-flex items-center gap-1.5 text-[10px] font-bold text-green-500 uppercase tracking-widest bg-green-500/10 px-2 py-0.5 rounded-full">
                      <span className="w-1 h-1 rounded-full bg-green-500 animate-pulse" />
                      Active
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-xs text-zinc-600 font-medium">
                      {u.created_at ? new Date(u.created_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    {editingId === u.id ? (
                      <div className="flex justify-end gap-2">
                        <button onClick={() => handleSave(u.id)} className="px-3 py-1 bg-blue-500 text-white rounded-lg text-[10px] font-bold hover:bg-blue-600 transition-all">Apply</button>
                        <button onClick={() => { setEditingId(null); setEditForm({}); }} className="px-3 py-1 bg-zinc-800 text-zinc-400 rounded-lg text-[10px] font-bold hover:bg-zinc-700 transition-all">Cancel</button>
                      </div>
                    ) : (
                      <div className="flex justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all transform translate-x-2 group-hover:translate-x-0">
                        <button
                          onClick={() => handleEdit(u)}
                          className="p-2 text-zinc-500 hover:text-white hover:bg-white/5 rounded-lg transition-all"
                          title="Edit User"
                        >
                          ✏️
                        </button>
                        {u.id !== currentUser.id && (
                          <button
                            onClick={() => setDeleteConfirmId(u.id)}
                            className="p-2 text-zinc-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-all"
                            title="Delete User"
                          >
                            🗑️
                          </button>
                        )}
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add User Modal */}
      {showAddModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-300">
          <div className="bg-white border border-zinc-200 w-full max-w-md rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="flex justify-between items-center mb-6">
              <h3 className="text-xl font-black text-zinc-950 tracking-tight">Provision New Member</h3>
              <button onClick={() => setShowAddModal(false)} className="text-zinc-400 hover:text-zinc-950 text-xl">✕</button>
            </div>
            
            <form onSubmit={handleAddUser} className="space-y-5">
              <div>
                <label className="text-[10px] uppercase font-black text-zinc-400 mb-2 block tracking-widest">Username</label>
                <input
                  type="text"
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. jdoe_ops"
                  value={addForm.username}
                  onChange={(e) => setAddForm({ ...addForm, username: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-zinc-400 mb-2 block tracking-widest">Initial Password</label>
                <input
                  type="password"
                  required
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:border-blue-500 outline-none transition-all"
                  placeholder="••••••••"
                  value={addForm.password}
                  onChange={(e) => setAddForm({ ...addForm, password: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-zinc-400 mb-2 block tracking-widest">Email Address</label>
                <input
                  type="email"
                  className="w-full bg-zinc-50 border border-zinc-200 rounded-xl px-4 py-3 text-zinc-900 focus:border-blue-500 outline-none transition-all"
                  placeholder="j.doe@company.com"
                  value={addForm.email}
                  onChange={(e) => setAddForm({ ...addForm, email: e.target.value })}
                />
              </div>
              <div>
                <label className="text-[10px] uppercase font-black text-zinc-400 mb-2 block tracking-widest">Access Role</label>
                <div className="grid grid-cols-2 gap-3">
                  {['Operator'].map((role) => (
                    <button
                      key={role}
                      type="button"
                      onClick={() => setAddForm({ ...addForm, role })}
                      className={`py-3 rounded-xl text-xs font-bold border transition-all ${
                        addForm.role === role 
                        ? 'bg-blue-500/10 border-blue-500 text-blue-400' 
                        : 'bg-white/5 border-white/10 text-zinc-400 hover:border-white/20'
                      }`}
                    >
                      {role}
                    </button>
                  ))}
                </div>
                <p className="text-[10px] text-zinc-400 mt-2 italic">
                  * Note: Admin roles must be granted by modifying existing records.
                </p>
              </div>

              <div className="pt-4 flex gap-3">
                <button
                  type="submit"
                  disabled={loading}
                  className="flex-1 bg-blue-500 hover:bg-blue-600 text-white font-black py-4 rounded-2xl text-sm transition-all shadow-xl shadow-blue-500/20 active:scale-[0.98]"
                >
                  {loading ? 'Creating...' : 'Finalize Creation'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteConfirmId && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-black/90 backdrop-blur-md animate-in fade-in duration-300">
          <div className="bg-[#0c0c0e] border border-red-500/20 w-full max-w-sm rounded-3xl p-8 shadow-2xl animate-in zoom-in-95 duration-300">
            <div className="text-center">
              <div className="w-16 h-16 bg-red-50 text-red-500 rounded-full flex items-center justify-center text-3xl mx-auto mb-4">⚠️</div>
              <h3 className="text-xl font-black text-zinc-950 mb-2">Confirm Deletion</h3>
              <p className="text-zinc-600 text-sm mb-8">
                You are about to permanently remove this user account. This will revoke all access immediately. This action is irreversible.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setDeleteConfirmId(null)}
                  className="flex-1 bg-zinc-900 border border-white/10 text-zinc-400 font-bold py-3 rounded-xl text-sm hover:text-white hover:bg-zinc-800 transition-all"
                >
                  Keep Account
                </button>
                <button
                  onClick={handleDeleteConfirm}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white font-black py-3 rounded-xl text-sm transition-all shadow-xl shadow-red-500/20"
                >
                  Delete Forever
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
