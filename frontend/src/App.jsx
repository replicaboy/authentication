import { useState } from 'react';
import axios from 'axios';
import { motion, AnimatePresence } from 'framer-motion';
import { Mail, Lock, KeyRound, Loader2, ArrowRight, ShieldCheck, Zap } from 'lucide-react';
import Chat from './Chat'; // <-- चैट कम्पोनेंट इम्पोर्ट किया

function App() {
  // नया State चैट पेज दिखाने या छिपाने के लिए
  const [isAuthenticated, setIsAuthenticated] = useState(!!localStorage.getItem('token')); 
  
  const [isLogin, setIsLogin] = useState(true);
  const [step, setStep] = useState(1); // 1: Email/Pass, 2: OTP
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [otp, setOtp] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [toast, setToast] = useState({ show: false, message: '', type: '' });

  // अपना Backend URL यहाँ चेक कर लें
  const API_URL = import.meta.env.VITE_BACKEND_URL;

  const showToast = (message, type) => {
    setToast({ show: true, message, type });
    setTimeout(() => setToast({ show: false, message: '', type: '' }), 4000);
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      if (isLogin) {
        // Login Logic
        const res = await axios.post(`${API_URL}/login`, { email, password });
        showToast('Login Successful! Welcome to Candy Chat', 'success');
        // --- नई लाइन ---
        localStorage.setItem('token', res.data.token || 'auth_token'); 
        localStorage.setItem('candy_email', email);
        setIsAuthenticated(true);
        
      } else {
        // Signup Logic
        const res = await axios.post(`${API_URL}/signup`, { email, password });
        showToast(res.data.message, 'success');
        setStep(2); // Move to OTP step
      }
    } catch (error) {
      showToast(error.response?.data?.message || 'Something went wrong', 'error');
    }
    setIsLoading(false);
  };

  const handleVerifyOTP = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      const res = await axios.post(`${API_URL}/verify-otp`, { email, otp });
      showToast('Verified! You can now login.', 'success');
      setStep(1);
      setIsLogin(true);
    } catch (error) {
      showToast(error.response?.data?.message || 'Invalid OTP', 'error');
    }
    setIsLoading(false);
  };

  // -------------------------------------------------------------
  // अगर यूजर ऑथेंटिकेटेड है, तो सीधा Chat पेज रेंडर करो
  // -------------------------------------------------------------
 
  if (isAuthenticated) {
    return <Chat onLogout={() => {
      localStorage.removeItem('token'); // टोकन डिलीट करो
      setIsAuthenticated(false); // लॉगआउट करो
    }} />;
  }

  // -------------------------------------------------------------
  // अगर यूजर ऑथेंटिकेटेड नहीं है, तो Login/Signup पेज रेंडर करो
  // -------------------------------------------------------------
  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden bg-slate-950">
      {/* Animated Background Gradients */}
      <div className="absolute inset-0 bg-gradient-to-br from-indigo-900/20 via-slate-900 to-purple-900/20 animate-gradient-x" />
      
      {/* Floating Glowing Orbs */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-blue-500/20 rounded-full blur-[100px] mix-blend-screen animate-float" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-purple-500/20 rounded-full blur-[100px] mix-blend-screen animate-float" style={{ animationDelay: '2s' }} />

      {/* Main UI Container */}
      <div className="w-full max-w-md p-4 relative z-10">
        
        {/* Toast Notification */}
        <AnimatePresence>
          {toast.show && (
            <motion.div
              initial={{ opacity: 0, y: -50 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -50 }}
              className={`absolute -top-16 left-0 right-0 p-3 rounded-xl backdrop-blur-md border text-center font-medium shadow-2xl ${
                toast.type === 'error' 
                  ? 'bg-red-500/10 border-red-500/50 text-red-400' 
                  : 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400'
              }`}
            >
              {toast.message}
            </motion.div>
          )}
        </AnimatePresence>

        <motion.div 
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.5 }}
          className="bg-slate-900/60 backdrop-blur-2xl border border-slate-700/50 p-8 rounded-3xl shadow-[0_0_50px_rgba(0,0,0,0.5)] shadow-purple-500/10"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <motion.div 
              className="inline-flex p-3 rounded-2xl bg-gradient-to-tr from-blue-600 to-purple-600 shadow-lg shadow-purple-500/30 mb-4"
              whileHover={{ rotate: 180, scale: 1.1 }}
              transition={{ duration: 0.3 }}
            >
              <Zap className="w-8 h-8 text-white" />
            </motion.div>
            <h1 className="text-3xl font-black tracking-tight text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-purple-500">
              Chodu Cid Chat
            </h1>
            <p className="text-slate-400 mt-2 text-sm font-medium">
              {step === 2 ? 'Secure your account' : (isLogin ? 'Welcome back, Agent' : 'Join the secure network')}
            </p>
          </div>

          <AnimatePresence mode="wait">
            {step === 1 ? (
              <motion.form 
                key="auth-form"
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                onSubmit={handleAuth}
                className="space-y-5"
              >
                <div className="space-y-4">
                  <div className="relative group">
                    <Mail className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-blue-400 transition-colors" />
                    <input
                      type="email"
                      required
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-11 py-3.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-blue-500/50 focus:ring-1 focus:ring-blue-500/50 transition-all"
                      placeholder="Email address"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>

                  <div className="relative group">
                    <Lock className="absolute left-4 top-3.5 w-5 h-5 text-slate-500 group-focus-within:text-purple-400 transition-colors" />
                    <input
                      type="password"
                      required
                      className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-11 py-3.5 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-purple-500/50 focus:ring-1 focus:ring-purple-500/50 transition-all"
                      placeholder="Password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                    />
                  </div>
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading}
                  className="w-full relative group overflow-hidden rounded-xl bg-gradient-to-r from-blue-600 to-purple-600 text-white font-bold py-3.5 px-4 shadow-[0_0_20px_rgba(124,58,237,0.3)] hover:shadow-[0_0_30px_rgba(124,58,237,0.5)] transition-all disabled:opacity-70"
                >
                  <div className="flex items-center justify-center gap-2">
                    {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : (
                      <>
                        <span>{isLogin ? 'Initialize Login' : 'Create Access Key'}</span>
                        <ArrowRight className="w-5 h-5 group-hover:translate-x-1 transition-transform" />
                      </>
                    )}
                  </div>
                </motion.button>

                <div className="text-center mt-6">
                  <button
                    type="button"
                    onClick={() => setIsLogin(!isLogin)}
                    className="text-slate-400 hover:text-white text-sm font-medium transition-colors"
                  >
                    {isLogin ? "Don't have an account? " : "Already an Agent? "}
                    <span className="text-purple-400 underline decoration-purple-500/30 underline-offset-4">
                      {isLogin ? 'Sign up' : 'Login'}
                    </span>
                  </button>
                </div>
              </motion.form>
            ) : (
              <motion.form 
                key="otp-form"
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                onSubmit={handleVerifyOTP}
                className="space-y-6"
              >
                <div className="bg-slate-950/50 border border-slate-800 rounded-xl p-4 text-center">
                  <ShieldCheck className="w-12 h-12 text-emerald-400 mx-auto mb-2" />
                  <p className="text-slate-300 text-sm">
                    Verification code sent to<br/>
                    <span className="font-bold text-white">{email}</span>
                  </p>
                </div>

                <div className="relative group">
                  <KeyRound className="absolute left-4 top-4 w-5 h-5 text-slate-500 group-focus-within:text-emerald-400 transition-colors" />
                  <input
                    type="text"
                    maxLength="6"
                    required
                    className="w-full bg-slate-950/50 border border-slate-800 rounded-xl px-12 py-4 text-center text-2xl tracking-[0.5em] font-bold text-white placeholder-slate-700 focus:outline-none focus:border-emerald-500/50 focus:ring-1 focus:ring-emerald-500/50 transition-all"
                    placeholder="------"
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                  />
                </div>

                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  disabled={isLoading || otp.length < 6}
                  className="w-full rounded-xl bg-gradient-to-r from-emerald-500 to-teal-600 text-white font-bold py-4 px-4 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:shadow-[0_0_30px_rgba(16,185,129,0.5)] transition-all disabled:opacity-70 flex items-center justify-center"
                >
                  {isLoading ? <Loader2 className="w-5 h-5 animate-spin" /> : 'Verify & Authenticate'}
                </motion.button>
              </motion.form>
            )}
          </AnimatePresence>
        </motion.div>
      </div>
    </div>
  );
}

export default App;