import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ArrowDown, ArrowUpRight, Wind, MapPin, Activity, CloudSun, Clock3, ShieldCheck, MessageCircle, RefreshCw, Search, Plus, X, Send, ChevronDown, Leaf, Navigation, Radio, CheckCircle2, AlertCircle } from "lucide-react";
import { ScrollScrub } from "@/components/scroll-scrub/scroll-scrub";
import { scrollScrubScenes, scrollScrubTheme } from "@/scroll-scrub-scenes";
import { getCommunityReports, getReportComments, submitNeighborhoodReport, submitReportComment, getModerationQueue, moderateCommunityItem } from "@/lib/api/airpulse.functions";

type Place = { name: string; admin1?: string; country?: string; latitude: number; longitude: number };
type AirData = { time?: string[]; us_aqi?: (number | null)[]; pm2_5?: (number | null)[]; pm10?: (number | null)[] };
type Report = { id: number; city: string; area: string; latitude?: number | null; longitude?: number | null; category: string; feeling: string; note: string; created_at: string };
type Comment = { id: number; report_id: number; display_name: string; body: string; created_at: string };

export const Route = createFileRoute("/")({ component: Index });

function Index() {
  const [place, setPlace] = useState<Place>({ name: "Kolkata", admin1: "West Bengal", country: "India", latitude: 22.5726, longitude: 88.3639 });
  const [query, setQuery] = useState("Kolkata");
  const [suggestions, setSuggestions] = useState<Place[]>([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [air, setAir] = useState<AirData | null>(null);
  const [weather, setWeather] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [apiError, setApiError] = useState("");
  const [reports, setReports] = useState<Report[]>([]);
  const [selectedReport, setSelectedReport] = useState<number | null>(null);
  const [comments, setComments] = useState<Comment[]>([]);
  const [commentName, setCommentName] = useState("Neighbor");
  const [commentBody, setCommentBody] = useState("");
  const [commentMessage, setCommentMessage] = useState("");
  const [reportOpen, setReportOpen] = useState(false);
  const [reportForm, setReportForm] = useState({ area: "Central area", category: "Dust", feeling: "Dusty", note: "" });
  const [reportMessage, setReportMessage] = useState("");
  const [reportBusy, setReportBusy] = useState(false);
  const [moderatorOpen, setModeratorOpen] = useState(false);
  const [moderatorKey, setModeratorKey] = useState("");
  const [queue, setQueue] = useState<{ reports: any[]; comments: any[] } | null>(null);
  const [moderationMessage, setModerationMessage] = useState("");
  const [trendMetric, setTrendMetric] = useState<"us_aqi" | "pm2_5" | "pm10">("us_aqi");

  const fetchReadings = useCallback(async (p: Place) => {
    setLoading(true); setApiError("");
    try {
      const coords = `latitude=${p.latitude}&longitude=${p.longitude}`;
      const [a, w] = await Promise.all([
        fetch(`https://air-quality-api.open-meteo.com/v1/air-quality?${coords}&hourly=us_aqi,pm2_5,pm10&forecast_days=2&timezone=auto`).then(r => { if (!r.ok) throw new Error("Air-quality source unavailable"); return r.json(); }),
        fetch(`https://api.open-meteo.com/v1/forecast?${coords}&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=auto`).then(r => { if (!r.ok) throw new Error("Weather source unavailable"); return r.json(); }),
      ]);
      setAir(a.hourly ?? null); setWeather(w.current ?? null); setUpdatedAt(new Date().toISOString());
    } catch (e) { setApiError("Live model data could not be reached. Check your connection and refresh."); setAir(null); setWeather(null); }
    finally { setLoading(false); }
  }, []);

  const loadReports = useCallback(async () => {
    try { const result = await getCommunityReports({ data: { limit: 24 } }); setReports((result.reports ?? []) as Report[]); }
    catch { setReports([]); }
  }, []);

  useEffect(() => { void fetchReadings(place); }, [place, fetchReadings]);
  useEffect(() => { void loadReports(); }, [loadReports]);
  useEffect(() => {
    if (!query.trim() || query.trim().length < 2) { setSuggestions([]); return; }
    const controller = new AbortController();
    const timer = window.setTimeout(async () => {
      try {
        const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(query)}&count=5&language=en&format=json`, { signal: controller.signal });
        const data = await response.json();
        setSuggestions((data.results ?? []).map((p: any) => ({ name: p.name, admin1: p.admin1, country: p.country, latitude: p.latitude, longitude: p.longitude })));
      } catch { setSuggestions([]); }
    }, 280);
    return () => { window.clearTimeout(timer); controller.abort(); };
  }, [query]);
  useEffect(() => {
    if (!selectedReport) { setComments([]); return; }
    void getReportComments({ data: { reportId: selectedReport } }).then(r => setComments((r.comments ?? []) as Comment[])).catch(() => setComments([]));
  }, [selectedReport]);

  const currentAqi = useMemo(() => {
    if (!air?.us_aqi?.length) return null;
    const index = air.time?.findIndex((t) => new Date(t).getTime() >= Date.now() - 60 * 60 * 1000) ?? 0;
    return air.us_aqi[Math.max(0, index)] ?? air.us_aqi[0] ?? null;
  }, [air]);
  const currentPm = useMemo(() => {
    if (!air?.pm2_5?.length) return null;
    const index = air.time?.findIndex((t) => new Date(t).getTime() >= Date.now() - 60 * 60 * 1000) ?? 0;
    return air.pm2_5[Math.max(0, index)] ?? air.pm2_5[0] ?? null;
  }, [air]);
  const chartPoints = useMemo(() => {
    const values = air?.[trendMetric]?.slice(0, 24).map(v => v == null ? 0 : Number(v)) ?? [];
    if (!values.length) return "";
    const max = Math.max(1, ...values);
    return values.map((v, i) => `${(i / Math.max(1, values.length - 1)) * 600},${148 - (v / max) * 120}`).join(" ");
  }, [air, trendMetric]);
  const mapBounds = useMemo(() => `${place.longitude - .08}%2C${place.latitude - .055}%2C${place.longitude + .08}%2C${place.latitude + .055}`, [place]);
  const mapSrc = `https://www.openstreetmap.org/export/embed.html?bbox=${mapBounds}&layer=mapnik&marker=${place.latitude}%2C${place.longitude}`;

  const choosePlace = (p: Place) => { setPlace(p); setQuery(p.name); setSuggestions([]); setShowSuggestions(false); };
  const useMyArea = () => {
    if (!navigator.geolocation) { setApiError("Location is not available in this browser. Search for a city instead."); return; }
    navigator.geolocation.getCurrentPosition(async pos => {
      const latitude = Math.round(pos.coords.latitude * 100) / 100;
      const longitude = Math.round(pos.coords.longitude * 100) / 100;
      try {
        const r = await fetch(`https://geocoding-api.open-meteo.com/v1/reverse?latitude=${latitude}&longitude=${longitude}&language=en&format=json`);
        const d = await r.json(); const x = d.results?.[0];
        choosePlace({ name: x?.name ?? "Nearby area", admin1: x?.admin1, country: x?.country, latitude, longitude });
      } catch { choosePlace({ name: "Nearby area", latitude, longitude }); }
    }, () => setApiError("Location permission was not granted. You can search for a city instead."), { enableHighAccuracy: false, timeout: 7000, maximumAge: 300000 });
  };
  const submitReport = async () => {
    if (reportForm.note.trim().length < 8) { setReportMessage("Please add a little more detail (at least 8 characters)."); return; }
    setReportBusy(true); setReportMessage("");
    try {
      const result = await submitNeighborhoodReport({ data: { city: place.name, area: reportForm.area, latitude: place.latitude, longitude: place.longitude, category: reportForm.category as any, feeling: reportForm.feeling as any, note: reportForm.note.trim() } });
      setReportMessage(result.message); if (result.ok) { setReportForm({ area: "Central area", category: "Dust", feeling: "Dusty", note: "" }); }
    } catch { setReportMessage("We couldn't submit that report. Please try again."); }
    finally { setReportBusy(false); }
  };
  const submitComment = async () => {
    if (!selectedReport || commentBody.trim().length < 3) return;
    try { const r = await submitReportComment({ data: { reportId: selectedReport, displayName: commentName, body: commentBody.trim() } }); setCommentMessage(r.message); if (r.ok) setCommentBody(""); }
    catch { setCommentMessage("Comment could not be submitted right now."); }
  };
  const loadQueue = async () => {
    try { const r = await getModerationQueue({ data: { key: moderatorKey } }); if (r.ok) { setQueue({ reports: (r.reports ?? []) as any[], comments: (r.comments ?? []) as any[] }); setModerationMessage("Moderator access verified."); } else { setQueue(null); setModerationMessage("Moderator key was not accepted."); } }
    catch { setQueue(null); setModerationMessage("Moderation is not configured yet. Set AIRPULSE_MODERATOR_KEY in website settings."); }
  };
  const moderate = async (kind: "report" | "comment", id: number, decision: "approved" | "rejected") => {
    try { const r = await moderateCommunityItem({ data: { key: moderatorKey, kind, id, decision } }); setModerationMessage(r.message); if (r.ok) await loadQueue(); }
    catch { setModerationMessage("That moderation action could not be completed."); }
  };

  return <main className="airpulse-page">
    <header className="topbar">
      <a className="brand" href="#top" aria-label="AirPulse home"><img src="/assets/brand/airpulse-mark.svg" alt="" /><span>airpulse<span className="brand-dot">.</span></span></a>
      <nav className="main-nav" aria-label="Main navigation"><a href="#snapshot">Live snapshot</a><a href="#explore">Explore map</a><a href="#community">Community</a><a href="#trends">Trends</a></nav>
      <a className="nav-cta" href="#community">Share a report <ArrowUpRight size={15}/></a>
    </header>

    <section id="top" className="journey-shell">
      <div className="journey-label"><span className="live-dot"/> PUBLIC AIR INTELLIGENCE <span className="label-rule"/> BUILT FOR NEIGHBORHOODS</div>
      <ScrollScrub scenes={scrollScrubScenes} theme={scrollScrubTheme} />
      <div className="journey-foot"><span>01 / THE ATMOSPHERE</span><a href="#snapshot">Explore live conditions <ArrowDown size={14}/></a><span>SCROLL TO EXPLORE</span></div>
    </section>

    <section id="snapshot" className="section snapshot-section">
      <div className="section-heading"><div><span className="eyebrow">THE LIVE PICTURE</span><h2>What's in the air <em>right now?</em></h2><p>Modelled conditions for a selected location, paired with local weather. Official station readings are shown separately when a verified feed is available.</p></div><div className="snapshot-actions"><button className="button-quiet" onClick={useMyArea}><Navigation size={15}/> Use my area</button><button className="button-outline" onClick={() => void fetchReadings(place)}><RefreshCw size={15} className={loading ? "spin" : ""}/> Refresh</button></div></div>
      <div className="location-search"><div className="search-box"><Search size={17}/><input aria-label="Search city" value={query} onChange={e => { setQuery(e.target.value); setShowSuggestions(true); }} onFocus={() => setShowSuggestions(true)} onKeyDown={e => { if (e.key === "Enter" && suggestions[0]) choosePlace(suggestions[0]); if (e.key === "Escape") setShowSuggestions(false); }} placeholder="Search a city or town"/>{query && <button aria-label="Clear search" onClick={() => { setQuery(""); setSuggestions([]); }}><X size={14}/></button>}</div>
        {showSuggestions && suggestions.length > 0 && <div className="suggestions">{suggestions.map((p,i) => <button key={`${p.name}-${p.latitude}-${i}`} onClick={() => choosePlace(p)}><MapPin size={15}/><span><strong>{p.name}</strong><small>{[p.admin1,p.country].filter(Boolean).join(", ")}</small></span><ArrowUpRight size={14}/></button>)}</div>}
        <span className="location-current"><MapPin size={13}/>{place.name}{place.admin1 ? `, ${place.admin1}` : ""}</span>
      </div>
      {apiError && <div className="notice notice-warn"><AlertCircle size={16}/>{apiError}</div>}
      <div className="data-grid">
        <article className="metric-card primary-metric"><div className="metric-top"><span>MODELLED US AQI</span><Activity size={17}/></div><div className="metric-number">{loading ? "-" : currentAqi == null ? "N/A" : Math.round(currentAqi)}<small>{currentAqi == null ? "" : aqiLabel(currentAqi)}</small></div><div className="metric-bottom"><span className="source-chip model-chip"><span/> Model estimate</span><span>Open-Meteo</span></div><div className="aqi-scale"><i/><i/><i/><i/><i/></div><p className="metric-note">Forecast-model estimate, not a regulatory station reading.</p></article>
        <article className="metric-card"><div className="metric-top"><span>PM2.5</span><Wind size={17}/></div><div className="metric-number">{loading ? "-" : currentPm == null ? "N/A" : Number(currentPm).toFixed(1)}<small>{currentPm == null ? "" : "µg/m³"}</small></div><div className="metric-bottom"><span className="source-chip model-chip"><span/> Model estimate</span></div><p className="metric-note">Fine particulate matter in the modeled atmosphere.</p></article>
        <article className="metric-card"><div className="metric-top"><span>TEMPERATURE</span><CloudSun size={17}/></div><div className="metric-number">{loading ? "-" : weather?.temperature_2m == null ? "N/A" : Math.round(weather.temperature_2m)}<small>{weather?.temperature_2m == null ? "" : "°C"}</small></div><div className="metric-bottom"><span className="source-chip weather-chip"><span/> Weather model</span></div><p className="metric-note">{weather?.relative_humidity_2m == null ? "" : `Humidity ${Math.round(weather.relative_humidity_2m)}%`}{weather?.wind_speed_10m == null ? "" : ` · Wind ${Math.round(weather.wind_speed_10m)} km/h`}</p></article>
        <article className="metric-card station-card"><div className="metric-top"><span>OFFICIAL STATION</span><Radio size={17}/></div><div className="station-state"><span className="station-icon"><ShieldCheck size={21}/></span><strong>Feed not connected</strong></div><div className="metric-bottom"><span className="source-chip station-chip"><span/> Verified source only</span></div><p className="metric-note">No official station value is displayed until a verified CPCB / public station feed is configured.</p></article>
      </div>
      <div className="data-footnote"><span><Clock3 size={13}/> {updatedAt ? `Updated ${new Date(updatedAt).toLocaleTimeString([], {hour:"2-digit",minute:"2-digit"})}` : "Waiting for first reading"}</span><span>Model data: Open-Meteo Air Quality + Weather APIs</span><a href="#methodology">How to read this <ArrowUpRight size={12}/></a></div>
    </section>

    <section id="explore" className="section explore-section">
      <div className="section-heading"><div><span className="eyebrow">A PLACE-BASED VIEW</span><h2>Air is local. <em>Context matters.</em></h2><p>Explore a location, then compare the model with what neighbors are noticing on the ground.</p></div><div className="map-key"><span><i className="key-model"/> Model location</span><span><i className="key-report"/> Community report</span></div></div>
      <div className="map-layout"><div className="map-frame"><iframe title={`Interactive map centered on ${place.name}`} src={mapSrc} loading="lazy" referrerPolicy="no-referrer-when-downgrade"/><div className="map-caption"><span className="map-pin-dot"/><span><strong>{place.name}</strong><small>Approximate city center</small></span><a href={`https://www.openstreetmap.org/?mlat=${place.latitude}&mlon=${place.longitude}#map=12/${place.latitude}/${place.longitude}`} target="_blank" rel="noreferrer" aria-label="Open larger map"><ArrowUpRight size={17}/></a></div></div>
        <aside className="map-side"><div className="map-side-top"><span className="eyebrow">NEARBY SIGNALS</span><span className="count-pill">{reports.filter(r => r.city.toLowerCase() === place.name.toLowerCase()).length} reports</span></div><h3>What people are noticing</h3><p>Community reports add human context. They are not sensor readings and do not affect the modeled AQI.</p>
          {reports.filter(r => r.city.toLowerCase() === place.name.toLowerCase()).slice(0,3).map(r => <button className="mini-report" key={r.id} onClick={() => { setSelectedReport(r.id); document.getElementById("community")?.scrollIntoView({behavior:"smooth"}); }}><span className="mini-report-mark"><MessageCircle size={15}/></span><span><strong>{r.category} · {r.area}</strong><small>{r.feeling} · {relativeTime(r.created_at)}</small></span><ArrowUpRight size={14}/></button>)}
          {reports.filter(r => r.city.toLowerCase() === place.name.toLowerCase()).length === 0 && <div className="empty-nearby"><span className="empty-rings"><MapPin size={19}/></span><strong>No approved reports yet</strong><small>Be the first to share what you notice in this area.</small></div>}
          <button className="button-mint full-width" onClick={() => { setReportOpen(true); document.getElementById("community")?.scrollIntoView({behavior:"smooth"}); }}>Add a local observation <Plus size={16}/></button>
        </aside></div>
    </section>

    <section id="community" className="section community-section">
      <div className="section-heading"><div><span className="eyebrow">THE HUMAN LAYER</span><h2>Many small signals. <em>One shared picture.</em></h2><p>Describe what you notice without sharing an exact address. Every submission is reviewed before it becomes public.</p></div><button className="button-mint" onClick={() => setReportOpen(true)}>Share an observation <Plus size={16}/></button></div>
      {reportOpen && <div className="report-composer"><div className="composer-heading"><div><span className="eyebrow">NEIGHBORHOOD REPORT</span><h3>What are you noticing?</h3></div><button className="icon-button" onClick={() => {setReportOpen(false);setReportMessage("");}} aria-label="Close report form"><X size={18}/></button></div><div className="composer-grid"><label>City or town<input value={place.name} readOnly/></label><label>Approximate area<input value={reportForm.area} onChange={e=>setReportForm({...reportForm,area:e.target.value})} maxLength={80} placeholder="e.g. near the market"/></label><label>Observation type<select value={reportForm.category} onChange={e=>setReportForm({...reportForm,category:e.target.value})}>{["Dust","Smoke","Odour","Haze","Traffic","Other"].map(x=><option key={x}>{x}</option>)}</select></label><label>How does it feel?<select value={reportForm.feeling} onChange={e=>setReportForm({...reportForm,feeling:e.target.value})}>{["Normal","Dusty","Smoky","Irritating","Unusual"].map(x=><option key={x}>{x}</option>)}</select></label><label className="composer-wide">Observation<textarea value={reportForm.note} onChange={e=>setReportForm({...reportForm,note:e.target.value})} maxLength={420} rows={3} placeholder="What did you notice, and around what time? Avoid names or exact addresses."/></label></div><div className="composer-bottom"><span><ShieldCheck size={15}/> Public location is rounded to an approximate area. Report is reviewed before publishing.</span><button className="button-mint" disabled={reportBusy} onClick={() => void submitReport()}>{reportBusy ? "Submitting…" : "Submit for review"} <Send size={15}/></button></div>{reportMessage && <p className="form-message">{reportMessage}</p>}</div>}
      <div className="community-layout"><div className="report-feed"><div className="feed-header"><strong>Neighborhood feed</strong><span>{reports.length} approved observations</span></div>
        {reports.length === 0 ? <div className="feed-empty"><div className="empty-rings"><MessageCircle size={22}/></div><h3>The feed starts with a neighbor.</h3><p>No approved reports are public yet. Submit an observation and it will appear here after moderation.</p><button className="button-outline" onClick={() => setReportOpen(true)}>Write the first report <ArrowUpRight size={15}/></button></div> : reports.map((r,i) => <article className={`report-card ${selectedReport===r.id?"report-selected":""}`} key={r.id}><div className="report-avatar">{r.category.slice(0,1).toUpperCase()}</div><div className="report-main"><div className="report-title"><strong>{r.category} near {r.area}</strong><span className="feeling-tag">{r.feeling}</span></div><p>{r.note}</p><div className="report-meta"><span><MapPin size={12}/>{r.area}, {r.city}</span><span><Clock3 size={12}/>{relativeTime(r.created_at)}</span></div><div className="report-actions"><button onClick={() => setSelectedReport(selectedReport===r.id?null:r.id)}><MessageCircle size={14}/>{selectedReport===r.id?"Hide comments":"Comments"}</button><span className="moderated-mark"><CheckCircle2 size={12}/> Reviewed</span></div>
          {selectedReport===r.id && <div className="comments-panel"><div className="comments-list">{comments.length===0?<small>No approved comments yet. Add a useful, respectful note.</small>:comments.map(c=><div className="comment-item" key={c.id}><strong>{c.display_name}</strong><p>{c.body}</p><small>{relativeTime(c.created_at)}</small></div>)}</div><div className="comment-form"><input value={commentName} onChange={e=>setCommentName(e.target.value)} aria-label="Display name" maxLength={32} placeholder="Display name"/><input value={commentBody} onChange={e=>setCommentBody(e.target.value)} aria-label="Write a comment" maxLength={280} placeholder="Add context or a helpful note"/><button aria-label="Submit comment" onClick={() => void submitComment()}><Send size={15}/></button></div>{commentMessage && <small className="form-message">{commentMessage}</small>}</div>}
        </div></article>)}
      </div><aside className="community-aside"><div className="community-principle"><span className="principle-icon"><Leaf size={20}/></span><span className="eyebrow">COMMUNITY, NOT A SENSOR</span><h3>People's experience is evidence of experience.</h3><p>A smoky smell or visible haze can help neighbors decide what to investigate. It is not a substitute for a calibrated monitor or an official AQI reading.</p></div><div className="safety-note"><ShieldCheck size={17}/><div><strong>Designed with privacy in mind</strong><p>No exact address, live personal tracking, or public identity is required. Location is approximate and all reports are moderated.</p></div></div><div className="moderator-entry"><button className="text-link" onClick={() => setModeratorOpen(!moderatorOpen)}>Moderator tools <ChevronDown size={14} className={moderatorOpen?"rotate":""}/></button>{moderatorOpen && <div className="moderator-panel"><p>For the site owner. Configure <code>AIRPULSE_MODERATOR_KEY</code> in website settings before using the review queue.</p><input type="password" value={moderatorKey} onChange={e=>setModeratorKey(e.target.value)} placeholder="Moderator key" autoComplete="off"/><button className="button-outline full-width" onClick={() => void loadQueue()}>Open review queue</button>{moderationMessage && <small>{moderationMessage}</small>}{queue && <div className="queue-items"><strong>Pending reports ({queue.reports.length})</strong>{queue.reports.map(r=><div className="queue-item" key={`r${r.id}`}><p><b>{r.category} · {r.city}, {r.area}</b><br/>{r.note}</p><div><button onClick={()=>void moderate("report",r.id,"approved")}>Approve</button><button onClick={()=>void moderate("report",r.id,"rejected")}>Reject</button></div></div>)}<strong>Pending comments ({queue.comments.length})</strong>{queue.comments.map(c=><div className="queue-item" key={`c${c.id}`}><p><b>{c.display_name}</b><br/>{c.body}</p><div><button onClick={()=>void moderate("comment",c.id,"approved")}>Approve</button><button onClick={()=>void moderate("comment",c.id,"rejected")}>Reject</button></div></div>)}</div>}</div>}</div></aside></div>
    </section>

    <section id="trends" className="section trends-section"><div className="section-heading"><div><span className="eyebrow">THE RECENT PATTERN</span><h2>Follow the <em>shape of the day.</em></h2><p>Hourly model estimates help show how conditions may change. This is a forecast-model series, not a record of official station measurements.</p></div><div className="trend-source"><Activity size={16}/><span>Hourly model data<br/><b>Open-Meteo</b></span></div></div>
      <div className="trend-card"><div className="trend-card-head"><div><span className="eyebrow">NEXT 24 HOURS</span><h3>{place.name} · Modelled trend</h3></div><div className="metric-tabs" role="group" aria-label="Trend metric"><button className={trendMetric==="us_aqi"?"active":""} onClick={()=>setTrendMetric("us_aqi")}>US AQI</button><button className={trendMetric==="pm2_5"?"active":""} onClick={()=>setTrendMetric("pm2_5")}>PM2.5</button><button className={trendMetric==="pm10"?"active":""} onClick={()=>setTrendMetric("pm10")}>PM10</button></div></div>
        {loading || !chartPoints ? <div className="chart-empty">{loading?"Loading hourly series…":"Trend data is unavailable. Refresh to try again."}</div> : <div className="chart-wrap"><div className="chart-y-labels"><span>{Math.round(Math.max(0,...(air?.[trendMetric]??[]).filter((v):v is number=>v!==null)))}</span><span>mid-range</span><span>0</span></div><svg className="trend-chart" viewBox="0 0 600 160" role="img" aria-label={`${trendMetric === "us_aqi" ? "US AQI" : trendMetric === "pm2_5" ? "PM2.5" : "PM10"} hourly model estimate trend`}><defs><linearGradient id="chartFill" x1="0" x2="0" y1="0" y2="1"><stop offset="0%" stopColor="var(--mint)" stopOpacity=".24"/><stop offset="100%" stopColor="var(--mint)" stopOpacity="0"/></linearGradient></defs>{[28,68,108,148].map(y=><line key={y} x1="0" x2="600" y1={y} y2={y} stroke="var(--line)" strokeDasharray="3 6"/>)}<polygon points={`0,160 ${chartPoints} 600,160`} fill="url(#chartFill)"/><polyline points={chartPoints} fill="none" stroke="var(--mint)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>{chartPoints.split(" ").filter((_,i)=>i%5===0).map((p,i)=><circle key={i} cx={p.split(",")[0]} cy={p.split(",")[1]} r="3" fill="var(--mint)" stroke="var(--panel)" strokeWidth="2"/>)}</svg><div className="chart-x-labels"><span>Now</span><span>+6h</span><span>+12h</span><span>+18h</span><span>+24h</span></div></div>}
        <div className="trend-foot"><span><Clock3 size={13}/> Hourly forecast window</span><span>Values can change as model inputs update.</span></div>
      </div>
    </section>

    <section id="methodology" className="section methodology-section"><div className="method-intro"><span className="eyebrow">TRANSPARENCY BY DESIGN</span><h2>Know where each signal <em>comes from.</em></h2><p>AirPulse is a community view of air conditions, not a regulatory monitoring authority. Each layer has a clear role.</p></div><div className="method-grid"><article><span className="method-index">01</span><div className="method-icon"><Radio size={19}/></div><h3>Official station data</h3><p>Reserved for verified public monitoring feeds, such as CPCB station data. This connection is not configured yet, so AirPulse does not display a fabricated station number.</p><span className="method-status status-pending"><i/> Awaiting verified source</span></article><article><span className="method-index">02</span><div className="method-icon"><Activity size={19}/></div><h3>Modelled estimates</h3><p>Open-Meteo air-quality and weather APIs provide modeled hourly values and current weather context. These are estimates, not direct measurements at your exact location.</p><span className="method-status status-live"><i/> Live API integration</span></article><article><span className="method-index">03</span><div className="method-icon"><MessageCircle size={19}/></div><h3>Neighborhood reports</h3><p>Residents share what they noticed and where, using an approximate area. Reports and comments remain private to the queue until reviewed.</p><span className="method-status status-live"><i/> Moderated submissions</span></article></div><div className="method-note"><ShieldCheck size={18}/><p><strong>One important distinction.</strong> A model estimate, a station measurement, and a person's observation are three different kinds of information. AirPulse keeps those labels visible so one is never mistaken for another.</p></div></section>

    <footer className="site-footer"><div className="footer-brand"><img src="/assets/brand/airpulse-mark.svg" alt=""/><span>airpulse<span className="brand-dot">.</span></span></div><p>Clearer air information, built around the places we share.</p><div className="footer-links"><a href="#methodology">Sources & methodology</a><a href="#community">Community guidelines</a><a href="#top">Back to top ↑</a></div><small>Public model data is indicative. Follow official health and environmental guidance for decisions that need verified measurements.</small><div className="footer-bottom"><span>© {new Date().getFullYear()} AirPulse</span><span>Made for a clearer picture.</span></div></footer>
  </main>;
}

function aqiLabel(value: number) { if (value <= 50) return "Good"; if (value <= 100) return "Moderate"; if (value <= 150) return "Sensitive groups"; if (value <= 200) return "Unhealthy"; if (value <= 300) return "Very unhealthy"; return "Hazardous"; }
function relativeTime(value: string) { const date = new Date(value.includes("Z") ? value : value.replace(" ", "T") + "Z"); const mins = Math.max(0, Math.floor((Date.now() - date.getTime()) / 60000)); if (!Number.isFinite(mins)) return "recently"; if (mins < 1) return "just now"; if (mins < 60) return `${mins}m ago`; if (mins < 1440) return `${Math.floor(mins/60)}h ago`; return `${Math.floor(mins/1440)}d ago`; }
